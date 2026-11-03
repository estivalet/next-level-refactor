"""
Gemini website tool (FR-SCR-7): the launcher's fallback when the free API limit is used up.

The launcher writes <data>/gemini/jobs/<id>/request.json and starts:

    python gemini_web.py --request <request.json> --profile <firefox profile> [--driver <path>]

For each 10 games it asks Gemini in Firefox and appends {"gameIds": [...], "reply": "..."}
to results.jsonl next to the request (flushed per line, so a crash keeps what was done), then
writes done.json. It never touches the launcher's database: the launcher checks each reply.

Exit codes: 0 done; 2 bad arguments or request; 3 Firefox/driver/browser failure; 4 sign-in
needed. Messages go to stderr.
"""

import argparse
import json
import os
import sys

from browser import Browser, BrowserStartError, LoginNeeded

BATCH_SIZE = 10
FIELDS = ('description', 'year', 'developer', 'publisher', 'genre', 'players')
HERE = os.path.dirname(os.path.abspath(__file__))

# The same rules as the launcher's prompt (apps/launcher/src/main/gemini/prompt.ts).
FIELD_HELP = {
    'description': 'a short, factual overview of the game (2–3 sentences)',
    'year': 'the year of its first release on this system (4 digits)',
    'developer': 'the company that developed it',
    'publisher': 'the company that published it on this system',
    'genre': 'its genre (e.g. "Sports", "Platform")',
    'players': 'how many players it supports (e.g. "1", "1-2", "4")',
}


class BadRequest(Exception):
    pass


def build_prompt(games, fields, language):
    keys = ', '.join(f'"{key}"' for key in ['gameId', 'title', *fields])
    help_lines = '\n'.join(f'- "{field}": {FIELD_HELP[field]}' for field in fields)
    listed = []
    for game in games:
        entry = {
            'gameId': game['gameId'],
            'system': game['system'],
            'title': game['title'],
            'file': game['file'],
        }
        if game.get('known'):
            entry['known'] = game['known']
        listed.append(json.dumps(entry, indent=1, ensure_ascii=False))
    return '\n'.join(
        [
            'You are a careful video game historian. For each game below, answer only what you are sure of.',
            'Rule: never guess; a wrong value is worse than none. If you are not sure, answer {"known": false, "value": null}.',
            f'Return a JSON array with one object per game, with the keys {keys}.',
            'Copy "gameId" exactly as given. Every other key is an object {"known": true|false, "value": ...}.',
            '- "title": the official title only if the given one is wrong or badly formatted; otherwise known false.',
            help_lines,
            f'Write "description" in {language}. "known" details are context only; don\'t repeat them.',
            '',
            'Games:',
            '\n'.join(listed),
        ]
    )


def read_request(path):
    try:
        with open(path, encoding='utf-8') as file:
            request = json.load(file)
    except (OSError, ValueError) as error:
        raise BadRequest(f'Cannot read the request: {error}') from error
    fields = request.get('fields') if isinstance(request, dict) else None
    games = request.get('games') if isinstance(request, dict) else None
    if not isinstance(fields, list) or not fields or any(f not in FIELDS for f in fields):
        raise BadRequest('The request has no valid fields.')
    if not isinstance(games, list) or not all(
        isinstance(g, dict) and isinstance(g.get('gameId'), int) for g in games
    ):
        raise BadRequest('The request has no valid games.')
    language = request.get('language') or 'English'
    return fields, games, language


def answered_ids(results_path):
    """Game ids already in results.jsonl (a resumed run skips them)."""
    done = set()
    if not os.path.exists(results_path):
        return done
    with open(results_path, encoding='utf-8') as file:
        for line in file:
            try:
                done.update(json.loads(line).get('gameIds', []))
            except ValueError:
                continue
    return done


def driver_path(given):
    return given or os.path.join(HERE, 'geckodriver.exe')


def main(argv=None, browser_factory=Browser):
    parser = argparse.ArgumentParser(description='Fill game details through the Gemini website.')
    parser.add_argument('--request', required=True)
    parser.add_argument('--profile')
    parser.add_argument('--driver', default='')
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 2
    if not args.profile:
        print('A Firefox profile folder is needed (--profile).', file=sys.stderr)
        return 2
    try:
        fields, games, language = read_request(args.request)
    except BadRequest as error:
        print(error, file=sys.stderr)
        return 2
    folder = os.path.dirname(os.path.abspath(args.request))
    results_path = os.path.join(folder, 'results.jsonl')
    done = answered_ids(results_path)
    remaining = [game for game in games if game['gameId'] not in done]
    browser = browser_factory()
    try:
        if remaining:
            browser.start(args.profile, driver_path(args.driver))
        with open(results_path, 'a', encoding='utf-8', newline='\n') as results:
            previous = None
            for start in range(0, len(remaining), BATCH_SIZE):
                batch = remaining[start : start + BATCH_SIZE]
                reply = browser.ask(build_prompt(batch, fields, language))
                # No reply, or the page still showing the last one: stop without a line, so
                # these games are asked again when the launcher resumes.
                if not reply.strip() or reply == previous:
                    raise RuntimeError('Gemini gave no new reply; stopping so it can be retried.')
                previous = reply
                line = {'gameIds': [game['gameId'] for game in batch], 'reply': reply}
                results.write(json.dumps(line, ensure_ascii=False) + '\n')
                results.flush()
    except LoginNeeded as error:
        print(error, file=sys.stderr)
        return 4
    except Exception as error:  # noqa: BLE001 - the launcher pauses on any browser failure
        print(error, file=sys.stderr)
        return 3
    finally:
        browser.close()
    with open(os.path.join(folder, 'done.json'), 'w', encoding='utf-8') as file:
        json.dump({'answered': len(games)}, file)
    return 0


if __name__ == '__main__':
    sys.exit(main())
