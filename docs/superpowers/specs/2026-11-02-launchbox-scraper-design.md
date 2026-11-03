# LaunchBox as a second scraper — design

Date: 2026-11-02 · Status: draft for owner review · Requirement: FR-SCR-6 (new, see §9)

## 1. Intent

ScreenScraper misses some games: newer or obscure titles, and some whole platforms are thin.
Example: *Ace Driver Collection* (Xbox 360) isn't on ScreenScraper but is in the LaunchBox Games
Database with metadata and art. The owner's old Python dashboard scraped LaunchBox's website
with Selenium and Firefox. That's fragile, and it can't ship in a product.

LaunchBox becomes a **second source that complements ScreenScraper**. ScreenScraper stays the
first choice. LaunchBox fills whatever ScreenScraper couldn't: games it can't find, and art
kinds or fields it has no data for.

## 2. Goals, non-goals, anti-goals

**Goals**
- Single game: the game context menu offers **Scrape from ScreenScraper…** (today's *Scrape…*,
  renamed) and **Scrape from LaunchBox…**. Both use the same dialog flow: candidates, preview,
  Apply.
- When a ScreenScraper search in the dialog finds nothing, the dialog offers **Try LaunchBox**.
- Batch scrape gets a **Then fill from LaunchBox** rule, on by default. Per game, ScreenScraper
  runs first, then LaunchBox fills what's still missing.
- No account, key or browser: LaunchBox data comes from its free public database download.

**Non-goals**
- Video: LaunchBox only has YouTube links, so video stays ScreenScraper-only.
- Reading the LaunchBox website (HTML). The download can lag the site slightly; that's accepted.
- LaunchBox's `Mame.xml` and `Files.xml`, and the LaunchBox app's own data formats.
- Using LaunchBox data for the online catalog (`apps/api`). This is client-side, personal
  scraping only.

**Anti-goals** (a failure even if it technically works)
- Writing anything outside the portable data folder (owner rule D50): no `%TEMP%`, no AppData.
- Overwriting fields the user edited (D19 locks) or art the user didn't tick.
- A batch silently applying weak LaunchBox matches. Weak matches go to *Needs review*.
- Shipping or committing the LaunchBox database itself in the repo.

## 3. The LaunchBox data (verified 2026-11-02)

- `https://gamesdb.launchbox-app.com/Metadata.zip`: 109 MB zip, regenerated daily.
  - It contains `Metadata.xml` (518 MB), `Platforms.xml`, `Mame.xml` and `Files.xml`. Only
    `Metadata.xml` and `Platforms.xml` are used.
- `Metadata.xml` holds about 190k `<Game>` records:
  - fields: `Name`, `ReleaseDate` or `ReleaseYear`, `Overview`, `MaxPlayers`, `Developer`,
    `Publisher`, `Genres` ("Fighting; Music"), `Platform`, `DatabaseID`, `CommunityRating`;
  - `<GameAlternateName>` rows (`AlternateName`, `DatabaseID`);
  - about 1.35M `<GameImage>` rows (`DatabaseID`, `FileName`, `Type`, optional `Region`,
    `CRC32`).
- Images download over plain HTTPS from `https://images.launchbox-app.com/<FileName>`.
- `Platforms.xml`: 190 platforms (`Name`) plus 431 `<PlatformAlternateName>` rows.
- Note: website URLs use a different id from `DatabaseID`. Ace Driver Collection is `/438312`
  on the site and `DatabaseID 472523` in the dump. Never rely on website ids.

## 4. Local index

- **Download:** the first use downloads `Metadata.zip` into `<data>\launchbox\` with a progress
  event.
  - The first LaunchBox scrape asks first ("Download the LaunchBox database (about 110 MB)?").
  - Settings → Scraper → LaunchBox shows the index date and a **Refresh** button.
- **Build:** stream-parse `Metadata.xml` straight out of the zip, never extracting 518 MB to
  disk. Write a compact SQLite index at `<data>\launchbox\launchbox.db` with:
  - games: id, name, normalized name, platform, year, developer, publisher, genres, players,
    overview, rating;
  - alternate names;
  - images, keeping only the types used in §5.
  - Then delete the zip.
- **Swap:** build into a temp file inside `<data>\launchbox\` and swap it in at the end. A failed
  or cancelled build keeps the previous index.
- **Status:** an index missing or still building makes LaunchBox actions answer a dedicated error
  (`LAUNCHBOX_INDEX_MISSING`), which the UI turns into the download prompt.
- **Builder's call:**
  - which streaming XML parser to use (a small dependency or a hand-written tag scanner; the
    format is flat and regular);
  - the exact table layout and indexes;
  - whether to keep MD5/CRC for later.

## 5. Art and field mapping

Art type fallbacks per NextLevel kind, first one present wins:

| NextLevel kind | LaunchBox `Type` (in order) |
|---|---|
| box-front | Box - Front, Box - Front - Reconstructed, Fanart - Box - Front |
| box-back | Box - Back, Box - Back - Reconstructed, Fanart - Box - Back |
| box-3d | Box - 3D |
| cart-front | Cart - Front, Disc, Fanart - Cart - Front, Fanart - Disc |
| fanart | Fanart - Background |
| screenshot-game-play | Screenshot - Gameplay |
| screenshot-game-title | Screenshot - Game Title |
| logo-clear | Clear Logo |
| marquee | Arcade - Marquee, Banner |
| video | (none) |

- **Region:** within one type, pick by the Settings → Scraper region priority. LaunchBox
  regions are names ("North America", "United States", "Europe", "World", "Japan"…), so the
  builder maps them to the priority codes (`us`, `eu`, `wor`, `jp`…). No region counts as
  `wor`, and a type's first image is the fallback.
- **Fields:**
  - title ← `Name`
  - year ← year of `ReleaseDate`, else `ReleaseYear`
  - developer, publisher ← as is
  - genre ← `Genres` as is (e.g. "Fighting; Music")
  - players ← `MaxPlayers` as text ("1", "4")
  - description ← `Overview`
  - rating ← `CommunityRating` (0–5) converted to the scale the library stores, if it has one.
    The builder checks how ScreenScraper's rating is stored and matches it; if no clean mapping
    exists, rating isn't offered for LaunchBox.

## 6. Matching a game

- **Platform:**
  - Each catalog system gains `scraper.launchboxPlatform` (a LaunchBox platform `Name`), next to
    `screenscraperId`.
  - It's filled at catalog seed time by matching the system name and aliases against
    `Platforms.xml` names and alternates. The seed script reads a `Platforms.xml` input the same
    way it reads its other inputs; it's never committed.
  - `settings.systems[id].launchboxPlatform` overrides it. Settings → Systems shows the field,
    like the ScreenScraper id.
  - A system with no platform answers `NO_LAUNCHBOX_PLATFORM`, and the dialog shows a platform
    picker (the 190 names, filterable), like today's ScreenScraper system picker.
- **Title match:**
  - Use the existing title normalization (`screenscraper/titles.ts`: region tags stripped,
    variants) against the normalized names and alternate names of that platform's games.
  - Rank by the same similarity measure the ScreenScraper ranker uses (`rank.ts`), with the same
    search threshold, so both sources behave alike.
  - There's no hash identify: LaunchBox has no ROM hashes for most systems.
- Candidates show name, year, platform, similarity and a box-front thumbnail. Thumbnails come
  through main (`nextlevel://` URL, builder names it), like ScreenScraper thumbnails.

## 7. Single-game flow (Scrape dialog)

- The context menu has **Scrape from ScreenScraper…** and **Scrape from LaunchBox…**. Both
  appear for one selected game. The dialog title says which source.
- The LaunchBox dialog is the existing dialog with a provider. Unchanged behaviour:
  - search on open;
  - **Search title** box;
  - candidate list;
  - preview table ("Already have a local file" / "Missing locally" / "Not on LaunchBox");
  - first ticks = missing art and empty fields;
  - **Overwrite existing**;
  - locks (D19);
  - Apply writes art where Settings → Storage says, through the same media writer and media
    index;
  - failures listed per kind.
- A ScreenScraper dialog whose search finds nothing shows **Try LaunchBox**, which switches the
  same dialog to LaunchBox for that game.
- **Scrape status:** `scrape_status` records which provider the last scrape used (new
  `provider` column, library migration; default `screenscraper` for existing rows).
  "Scraped <date>" in the details can say "from LaunchBox".

## 8. Batch flow

- **New rule:** `BatchRules.launchbox: boolean`. The Batch rules dialog shows it as **Then fill
  from LaunchBox**.
  - It's ticked by default only when the LaunchBox index exists. Otherwise it's unticked, with
    a "Download the LaunchBox database first" link to Settings → Scraper. *(Designer's call, so
    a batch never pauses right away for a database the user never downloaded.)*
  - The LaunchBox step **always fills only what's missing**, even when the batch's *Only
    missing* is off. LaunchBox complements ScreenScraper and never replaces what ScreenScraper
    (or the user) just put there. *(Designer's call.)*
  - Batch never writes `title` from LaunchBox either (D19).
- **Per game,** after the ScreenScraper step (applied, review, not found, or nothing to do
  because ScreenScraper had no data):
  1. Recompute what the game may still receive (`batchTargets` with `onlyMissing` semantics,
     after the ScreenScraper apply, so only what's still missing).
  2. If anything is left, search LaunchBox and decide with the D18 rule minus hash: a single
     candidate with similarity ≥ 90 → apply; several or a weak one → *Needs review*
     (provider `launchbox`); none → leave the ScreenScraper outcome.
- **Counting:** a game counts once, by its best outcome (applied beats review beats not found).
  The batch status adds a `launchbox` count (games LaunchBox wrote to) so the progress can say
  "of which N from LaunchBox".
- **No index:** if the LaunchBox index is missing, the batch pauses once with reason `launchbox`
  ("Download the LaunchBox database or turn off Then fill from LaunchBox").
- **Network:** image download failures follow the existing network-pause rules.
- **Needs review:** a LaunchBox review game opens the LaunchBox dialog from *Needs review*; a
  ScreenScraper one keeps opening the ScreenScraper dialog.
- **Rate:** LaunchBox images need no quota. The builder adds a small delay between image
  downloads (be polite, about 2 per second).

## 9. Docs and requirements

- New **FR-SCR-6**: "LaunchBox Games Database as a second scraper: single game and batch fill
  after ScreenScraper, from its public database download indexed locally." (S, owner request
  2026-11-02.)
- Update `docs/02-design/scraping-guide.md` (sources, the download, Refresh, platform picker),
  the screen spec (menu entries, dialog, batch rule), the data model (`scrape_status.provider`,
  the launchbox index files) and the CHANGELOG.

## 10. Testing

- **Fixtures:** a tiny `Metadata.xml` and `Platforms.xml` (a few games, alternates and images,
  including Ace Driver Collection's shape) zipped in a test fixture. The index build runs on it.
  No test touches the network.
- **Units:**
  - type and region selection;
  - field extraction;
  - platform seed matching;
  - title ranking (an alternate name hit);
  - batch decide and "best outcome" counting;
  - the migration default.
- **Integration:**
  - dialog with provider LaunchBox (search, preview, apply writes through the media writer);
  - Try LaunchBox;
  - batch with ScreenScraper not found → LaunchBox applied, and ScreenScraper applied →
    LaunchBox fills only a missing kind;
  - missing index → prompt / batch pause.
- **One e2e:** a fake LaunchBox images server, plus an index built from the fixture.

## 11. Left to the builder

- Parser choice, index schema, thumbnail URL name, the exact region-name table.
- How the dialog takes its provider.
- Whether ScreenScraper's ranker is reused directly or through a small shared module.
- Sub-PR split. A natural split is (a) index + Settings, (b) single-game dialog, (c) batch.
