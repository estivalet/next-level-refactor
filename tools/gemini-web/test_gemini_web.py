"""Tests for the Gemini website tool (FR-SCR-7); the browser is always faked."""

import json

import pytest

import gemini_web
from browser import BrowserStartError, LoginNeeded


def game(game_id):
    return {
        'gameId': game_id,
        'system': 'Coleco Telstar',
        'title': f'Game {game_id}',
        'file': f'game{game_id}.bat',
        'known': {'year': 1976} if game_id == 1 else {},
    }


def write_request(folder, count, **extra):
    request = {
        'jobId': 3,
        'fields': ['year', 'developer'],
        'language': 'English',
        'games': [game(i) for i in range(1, count + 1)],
        **extra,
    }
    path = folder / 'request.json'
    path.write_text(json.dumps(request), encoding='utf-8')
    return path


class FakeBrowser:
    def __init__(self, fail_at=None, start_error=None):
        self.prompts = []
        self.fail_at = fail_at
        self.start_error = start_error
        self.closed = False

    def start(self, profile, driver):
        if self.start_error:
            raise self.start_error

    def ask(self, prompt):
        self.prompts.append(prompt)
        if self.fail_at is not None and len(self.prompts) == self.fail_at:
            raise RuntimeError('Could not find Gemini input box.')
        return f'```json\n[{{"gameId": {len(self.prompts)}}}]\n```'

    def close(self):
        self.closed = True


def run(path, browser, *extra):
    return gemini_web.main(
        ['--request', str(path), '--profile', 'C:/ff/profile', *extra],
        browser_factory=lambda: browser,
    )


def lines(folder):
    text = (folder / 'results.jsonl').read_text(encoding='utf-8')
    return [json.loads(line) for line in text.splitlines()]


def test_fr_scr_7_sends_10_games_per_prompt_and_writes_one_line_per_reply(tmp_path):
    path = write_request(tmp_path, 23)
    browser = FakeBrowser()
    assert run(path, browser) == 0
    assert len(browser.prompts) == 3
    written = lines(tmp_path)
    assert [len(line['gameIds']) for line in written] == [10, 10, 3]
    assert written[0]['gameIds'] == list(range(1, 11))
    assert written[0]['reply'].startswith('```json')
    assert json.loads((tmp_path / 'done.json').read_text(encoding='utf-8')) == {'answered': 23}
    assert browser.closed


def test_fr_scr_7_the_prompt_keeps_the_launcher_rules(tmp_path):
    path = write_request(tmp_path, 2)
    browser = FakeBrowser()
    run(path, browser)
    prompt = browser.prompts[0]
    assert 'never guess; a wrong value is worse than none' in prompt
    assert 'Copy "gameId" exactly as given' in prompt
    assert '"gameId": 1' in prompt
    assert 'Coleco Telstar' in prompt
    assert 'game2.bat' in prompt
    assert '"year": 1976' in prompt
    assert 'Write "description" in English' in prompt
    assert '"developer"' in prompt
    assert '"publisher"' not in prompt


def test_fr_scr_7_resume_skips_games_already_in_the_results(tmp_path):
    path = write_request(tmp_path, 12)
    (tmp_path / 'results.jsonl').write_text(
        json.dumps({'gameIds': list(range(1, 11)), 'reply': '[]'}) + '\n', encoding='utf-8'
    )
    browser = FakeBrowser()
    assert run(path, browser) == 0
    assert len(browser.prompts) == 1
    assert '"gameId": 11' in browser.prompts[0]
    assert '"gameId": 1,' not in browser.prompts[0]
    assert len(lines(tmp_path)) == 2


def test_fr_scr_7_a_crash_keeps_the_lines_already_written_and_exits_3(tmp_path, capsys):
    path = write_request(tmp_path, 25)
    browser = FakeBrowser(fail_at=2)
    assert run(path, browser) == 3
    assert len(lines(tmp_path)) == 1
    assert not (tmp_path / 'done.json').exists()
    assert 'Could not find Gemini input box.' in capsys.readouterr().err
    assert browser.closed


def test_fr_scr_7_firefox_not_starting_is_3_and_a_login_page_is_4(tmp_path):
    path = write_request(tmp_path, 1)
    assert run(path, FakeBrowser(start_error=BrowserStartError('Firefox is open'))) == 3
    assert run(path, FakeBrowser(start_error=LoginNeeded('sign in'))) == 4


@pytest.mark.parametrize(
    'content',
    ['not json', json.dumps({'jobId': 3}), json.dumps({'jobId': 3, 'fields': [], 'games': []})],
)
def test_fr_scr_7_a_bad_request_is_2(tmp_path, content):
    path = tmp_path / 'request.json'
    path.write_text(content, encoding='utf-8')
    assert run(path, FakeBrowser()) == 2


def test_fr_scr_7_a_missing_request_or_profile_is_2(tmp_path):
    assert run(tmp_path / 'nope.json', FakeBrowser()) == 2
    assert gemini_web.main(['--request', str(write_request(tmp_path, 1))]) == 2


def test_fr_scr_7_the_driver_is_the_given_one_or_the_one_next_to_the_tool(tmp_path):
    assert gemini_web.driver_path('C:/drivers/geckodriver.exe') == 'C:/drivers/geckodriver.exe'
    assert gemini_web.driver_path('').endswith('geckodriver.exe')
    assert 'gemini-web' in gemini_web.driver_path('')


class RepeatingBrowser(FakeBrowser):
    """The page kept the previous answer (or showed none): the same text twice, then empty."""

    def ask(self, prompt):
        self.prompts.append(prompt)
        return ['[{"gameId": 1}]', '[{"gameId": 1}]', ''][len(self.prompts) - 1]


def test_fr_scr_7_review_fix_4_an_empty_or_repeated_reply_writes_no_line(tmp_path):
    path = write_request(tmp_path, 30)
    browser = RepeatingBrowser()
    assert run(path, browser) == 3
    written = lines(tmp_path)
    assert len(written) == 1
    assert written[0]['gameIds'] == list(range(1, 11))
