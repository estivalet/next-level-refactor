# Gemini website tool

The launcher's fallback for **Fill details with Gemini** (FR-SCR-7). When the free Gemini API
limit is used up, a Gemini batch can use the **Gemini website tool** route instead. That route has
no daily limit. The launcher starts this tool, the tool drives gemini.google.com in Firefox, and
the launcher checks every answer the same way as an API answer.

This is a personal tool: it isn't shipped to players.

## Setup

1. Install Python 3 and Selenium:

   ```
   python -m pip install -r tools/gemini-web/requirements.txt
   ```

2. Download `geckodriver.exe` (https://github.com/mozilla/geckodriver/releases) and put it next to
   `gemini_web.py`, or set its path in Settings → Scraper → Gemini website tool. The tool never
   downloads a driver into your user profile.
3. In Firefox, sign in to Google and open gemini.google.com once, using the profile you will give
   the launcher.
4. In Settings → Scraper → Gemini website tool, set **Python program** (for example
   `C:\Python314\python.exe`) and **Firefox profile folder** (`about:profiles` in Firefox shows it).

Close Firefox before a batch starts: Selenium can't open a profile that is already in use.

## How it works

```
python gemini_web.py --request <data>\gemini\jobs\<id>\request.json --profile <folder> [--driver <geckodriver.exe>]
```

- `request.json` (written by the launcher) lists the games, the fields to ask and the description
  language. It never contains an API key.
- Every 10 games the tool appends one line to `results.jsonl`:
  `{"gameIds": [...], "reply": "<Gemini's text>"}`. The file is flushed line by line, so a crash
  keeps what was done, and a second run skips games already answered.
- `done.json` marks the end.
- Exit codes: `0` done, `2` bad arguments or request, `3` Firefox, driver or page failure, `4`
  sign-in needed. The reason goes to stderr.

The tool never touches the launcher's database.

## Tests

```
python -m pytest tools/gemini-web -q
```

The browser is faked in the tests, so they need neither Firefox nor Selenium.
