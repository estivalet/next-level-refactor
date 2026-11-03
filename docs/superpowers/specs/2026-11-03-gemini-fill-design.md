# Gemini fills missing game details — design

Date: 2026-11-03 · Status: draft for owner review · Requirement: FR-SCR-7 (new, see §9)

## 1. Intent

ScreenScraper and LaunchBox leave gaps, mostly on obscure systems: no year, no developer, no
description. The owner's old Python dashboard asked Gemini to fill those gaps by driving the
Gemini website with Selenium and Firefox, and it worked.

The rebuild gets two ways to ask Gemini, which both end in the same place:

1. **The Gemini API, built into the launcher** (the main route). It uses a free Google AI Studio
   key with no billing account, so it can never cost money; when the free daily allowance is
   used up, requests are refused until the next day.
2. **The Gemini website through Selenium, as a separate tool** (the fallback, owner's request).
   It has no daily limit. The launcher starts it with a button, and its answers come back into
   the launcher through the same review/apply path as the API.

The rule above everything else (owner's words): **it must not make things up. If Gemini doesn't
know, it says so, and the field stays empty.**

## 2. Goals, non-goals, anti-goals

**Goals**
- Single game: the game context menu gets **Fill details with Gemini…**. It asks only for the
  details the game is missing, shows a preview, and saves only what the user ticks.
- Batch: a system, several systems or a selection, in one of two modes the user picks each time:
  **Review** (answers wait in *Needs review*) or **Auto-update** (answers are saved right away).
  The owner mostly wants this for obscure systems.
- The fallback tool: a **Fill with Gemini website** button starts the Selenium tool for the same
  scope and mode, and its answers come back through the same path.
- Fields: description, year, developer, publisher, genre, players. **Title** only as a
  suggestion (§5).

**Non-goals**
- Art. Gemini gives text only.
- Rating. Gemini has no real source for a rating, so it isn't asked.
- Shipping the Selenium tool to other players. It's the owner's personal tool: it needs Python,
  Selenium and Firefox on the PC.
- Paid tiers, billing, or any Google Cloud setup beyond an AI Studio key.

**Anti-goals** (a failure even if it technically works)
- **Made-up details.** Unknown must stay unknown; any answer that fails the checks in §6 is
  dropped as unknown, never saved "close enough".
- Changing a title without the user ticking it, anywhere, including an Auto-update batch.
- Overwriting a field that already has a value, or a locked field (D19), unless the user ticks it
  in the single-game dialog.
- Spending money: the launcher never asks for billing, and a quota refusal is a pause, not a
  retry loop.
- Writing outside the portable data folder (D50). That includes the tool's driver downloads (§8).
- Asking Gemini again for an answer it already gave: opening a *Needs review* game shows the
  stored answer and doesn't spend quota.

## 3. Settings

Settings → Scraper gets a **Gemini** section:
- **API key**: stored in the OS secret store like the ScreenScraper credentials (new
  `SecretKey` `gemini.apiKey`; reported only as "set / not set"). A **Test** button sends one tiny
  request and says OK, "key rejected" or "daily limit reached".
- A one-line help text with the AI Studio link: create a key in Google AI Studio and don't add
  billing.
- **Model**: a select with a sensible free-tier default (the builder checks which Flash model is
  free at build time and makes it the default; the user can change it).
- **Check answers with Google Search** (on when available, see §6): the builder checks whether
  the free tier allows Search grounding for the default model. If it doesn't, the option isn't
  shown.
- **Gemini website tool** (only the fallback): Python program path, Firefox profile folder.
  Empty = the button explains what's missing instead of starting.

## 4. Single-game flow

- Context menu, one selected game: **Fill details with Gemini…**, next to *Scrape from
  ScreenScraper…* and *Scrape from LaunchBox…*.
- No key yet → the dialog says so and links to Settings → Scraper.
- The dialog asks Gemini once on open, for the game's **empty fields only** (plus the title
  suggestion). An **Ask about all fields** toggle re-asks for every field, so the user can compare
  with what's there.
- The preview reuses the existing preview table: each field shows the current value (or empty)
  and Gemini's answer. A field Gemini doesn't know shows **"Gemini doesn't know"**, disabled.
- Ticked at first: empty fields with an answer. Never ticked at first: fields that already have a
  value, locked fields, and the title.
- **Apply** writes through the existing `writeScrape` path (fields, locks D19, scrape status,
  change event), with provider `gemini` and no art kinds.
- Errors are their own messages: no key, key rejected, daily limit reached ("try again tomorrow,
  or use the Gemini website tool"), network.

## 5. Title

- Gemini may suggest a corrected official title. The dialog shows it as a suggestion row,
  **never ticked at first**.
- A batch never writes the title, in either mode (D19 already keeps title out of batch fields).
  In *Review* mode the suggestion is kept with the stored answer and shows when the game is
  opened from *Needs review*.

## 6. Not making things up

- **The prompt** (builder writes it, tests pin its rules):
  - it says the system (catalog name), the game title and the ROM file name, plus any details
    the game already has (year, developer) as context;
  - each requested field must be answered or marked unknown, and **unknown is the expected answer
    when not sure** ("never guess; a wrong value is worse than none");
  - the description is a short, factual overview (2–3 sentences), in the first language of
    Settings → Scraper language priority (empty = the app language, then English).
- **Structured output**: the API call uses Gemini's JSON response schema, so each field comes
  back as `{ known: boolean, value }`. Temperature 0. Batches send several games per request (the
  builder picks the size, about 10) to save quota; each answer echoes the game's id so answers
  can't be matched to the wrong game.
- **Checks before anything is shown or saved** (failing = unknown):
  - year: 4 digits, between 1950 and the current year;
  - players: "1", "1-2", "2-4"… (digits and one dash), at most 16;
  - developer, publisher, genre: plain text up to a sane length, no "unknown"/"N/A"/"?" style
    fillers;
  - description: not empty, not a refusal or an apology, up to about 600 characters;
  - title suggestion: dropped when it only differs in case or punctuation from the current
    title.
- **Search grounding** (only when the free tier allows it, §3): the request uses Google Search
  grounding, and the dialog shows the source links Gemini used. A batch in Auto-update mode with
  grounding on saves only fields Gemini answered **with** at least one source; the rest go to
  *Needs review*. *(Designer's call: grounding is the strongest guard against invented details,
  so Auto-update leans on it when it exists.)*

## 7. Batch flow

- A separate **Fill details with Gemini** batch, started from the Library like the scrape batch
  (a system, the systems ticked in a list, or the selected games). It isn't a step inside the
  ScreenScraper batch, because the systems that need it most often have no ScreenScraper id,
  which that batch refuses. *(Designer's call.)*
- The rules dialog: the fields to fill (default: all six), **Review** or **Auto-update**, and
  the route: **Gemini API** or **Gemini website tool**.
- Only games with at least one empty requested field are asked; filled fields are never sent.
- It reuses the batch machinery the scrape batch already has (job row, cursor, resume after a
  restart, pause, cancel, progress event), so the batch survives a restart. Whether Gemini jobs
  share `scrape_jobs` with a new `source` column or get their own table is the builder's call.
- **Outcomes per game:** saved (Auto-update), needs review (Review, or Auto-update without a
  source when grounding is on), nothing known (every field unknown), failed.
- **Daily limit:** a quota refusal pauses the batch with reason `gemini-quota` ("Gemini's free
  daily limit is used up; it resumes tomorrow, or switch to the Gemini website tool"). It
  resumes on its own the next day, like ScreenScraper's quota pause. Per-minute limits (HTTP 429
  with a retry delay) wait and continue.
- **Needs review:** the stored answer (fields, title suggestion, sources) opens in the Gemini
  dialog without a new request. Apply saves; **Dismiss** clears the stored answer.

## 8. The Gemini website tool (Selenium fallback)

- Lives in the repo as its own small tool: `tools/gemini-web/` (Python 3, Selenium,
  `requirements.txt`, its own README). It starts from the old dashboard's
  `scrapers/gemini_scraper.py` (Firefox profile login, prompt typing, waiting on the stop button,
  JSON extraction), with the prompt and checks of §6. The copy keeps working on its own as a
  command-line tool for testing.
- **Hand-off through files, never the database:**
  - The launcher writes `<data>\gemini\jobs\<job id>\request.json`: the games (id, system name,
    title, ROM file name, existing details), the fields, and the description language.
  - It starts the tool with that file (Settings path to Python) and shows the batch progress.
  - The tool appends one line per answered game to `results.jsonl` in the same folder (so a
    crash keeps what was done) and writes `done.json` at the end.
  - The launcher reads new lines while the tool runs (progress) and once more at the end. Each
    line goes through the same checks (§6) and the same Review / Auto-update handling as an API
    answer. It never touches `library.db` from Python: writing while the launcher is open could
    clash, and the launcher wouldn't see the change.
  - A job folder left over from a crash or a closed launcher is picked up at the next start; the
    folder is deleted once its results are applied.
- **Portable rule:** the tool keeps its geckodriver in `tools/gemini-web/` or in the data
  folder, never `~/.wdm` (set `WDM_LOCAL`/the cache path, or a driver path in Settings; builder's
  call).
- Firefox must be closed while the tool runs (profile lock); the button says so before
  starting.
- Website answers carry no sources. They follow the mode like API answers without grounding
  (Auto-update saves what passed the §6 checks); the rules dialog notes "the website gives no
  sources" when that route is chosen. *(Designer's call.)*
- Packaged builds show the button only when the tool's paths are set.

## 9. Docs and requirements

- New **FR-SCR-7**: "Gemini fills missing game details (owner request 2026-11-03): single game
  and batch (Review or Auto-update), through a free Gemini API key, with a Selenium website tool
  as a fallback; unknown stays unknown." (S.)
- `ScrapeProvider` gains `gemini` (scrape status, "Scraped <date> from Gemini").
- Update the scraping guide (key setup without billing, what Gemini fills and never fills,
  the tool), the screen spec (menu entry, dialog, batch dialog, Settings section), the data model
  (secret key, stored answers, job table, `<data>\gemini\` files) and the CHANGELOG.

## 10. Testing

- No test calls Google. A fake Gemini client returns canned JSON; an e2e uses a local fake
  server through a dev-only URL override, like LaunchBox.
- **Units:** prompt rules, the §6 checks (each filler and bad value becomes unknown), batch
  packing and id echo, quota pause and next-day resume, 429 wait, grounding rule for
  Auto-update, title never in batch, stored answer reopens without a request.
- **Tool:** pytest for the request/results file format and checks, with the browser part mocked
  (the old script had none). The launcher side has a test with a fake tool process that writes
  `results.jsonl` lines, including a crash halfway.
- **One e2e:** Fill details with Gemini… on a game with an empty year → preview → Apply → the
  details show the year.

## 11. Left to the builder

- REST call vs `@google/genai` (the API is a few JSON requests; no new dependency needed).
- The default model, the batch size, exact length limits.
- Job table layout and where stored answers live.
- Sub-PR split. A natural split is (a) Settings, client, checks and the single-game dialog,
  (b) the batch, (c) the website tool and its hand-off.
