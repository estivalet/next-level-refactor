# Scraping guide

How to fetch box art, logos, screenshots, videos and game details from
[ScreenScraper](https://www.screenscraper.fr): one game at a time, or a whole system in the
background. For the screens see [screen-specifications.md](screen-specifications.md) S7
(Library) and S9 (Settings → Scraper, Settings → Storage).

## 1. Your ScreenScraper account

**Settings → Scraper → ScreenScraper account.**

1. Enter your ScreenScraper **user name** and **password**. A free account works; a paid one
   gets more requests per day and more threads.
2. Open **Developer credentials** and enter the developer id and password (D15). Without them
   ScreenScraper answers nothing.
3. Click **Save credentials**, then **Test**. It shows "Signed in as <you> · N of M requests
   today".

The four values go to the Windows credential store (`secrets.bin`, encrypted with your Windows
account). They are never written to the settings file, backups or logs. **Remove** deletes them.

On the same page:
- **Regions**: the region order used to pick art (default: USA, Europe, World, Japan).
- **Languages**: the language order for descriptions and genres. Empty means the app language,
  then English.
- **Art kinds** and **fields**: what a batch fills in by default.

## 2. Where the art goes

**Settings → Storage → Where scraped art goes.**

| Choice | Files |
|---|---|
| **Next to the ROMs** (default) | `<storage location>\<system folder>\media\<kind>\<ROM name>.<ext>`, the layout NextLevelOS uses |
| **One central folder** | `<central folder>\<system id>\<kind>\<ROM name>.<ext>` |

`<ROM name>` is the ROM's file name without its extension, exactly as on disk, even with
`(USA)`, `[!]`, accents or a trailing dot. A ROM in a subfolder (`!hacks\Game.sfc`) uses only
its file name.

The scan reads the central folder first. Kinds the central folder lacks come from the per-ROM
folders. A central folder that doesn't exist is no art, not an error. After changing this
setting, **Scan all** so the library sees the art where it now is.

### Formats (D17)

Files are written so that both NextLevel and NextLevelOS load them:

| Kind | File |
|---|---|
| Images (box front/back/3D, cartridge, logo, marquee, screenshots) | `.png`. JPEG and WebP from ScreenScraper are converted. |
| Fanart | `.jpg` when ScreenScraper sends JPEG, else `.png` |
| Video | `.mp4` |

The new file is saved first, then other files with the same name in that kind folder are
removed (e.g. an old `Game.jpg` next to the new `Game.png`). A download that isn't an image is
refused, so it never replaces good art. The Library and the themes show a replaced image at
once.

Art kind folders: `box-front`, `box-back`, `box-3d`, `cart-front`, `fanart`, `video`,
`screenshot-game-play`, `screenshot-game-title`, `logo-clear`, `marquee` (D16).

## 3. Scrape one game

Right-click a game in the Library and choose **Scrape…**.

1. The dialog searches at once:
   - first by the ROM file itself (hash; files under 512 MiB, not `.m3u`, `.cue` or `.gdi`),
     shown as **Exact match**;
   - otherwise by the game's title.

   The best candidate is selected. Type another title in **Search title** to search again.
2. The preview lists every art kind ("Already have a local file", "Missing locally" or "Not on
   ScreenScraper") and every field (your value struck through, then ScreenScraper's).
3. Ticked at first: art you don't have and fields that are empty. **Overwrite existing** ticks
   everything ScreenScraper has.
4. **Fields you edited** (lock icon) and the **title** are never ticked for you. Tick one to
   take ScreenScraper's value; it stays locked afterwards (D19).
5. **Apply** writes the art and fields. If a kind couldn't be saved, the dialog lists it and
   stays open.

If the system isn't linked to a ScreenScraper system yet, the dialog asks you to choose one
(**Save system**). It is saved in Settings → Systems.

The details panel then shows the box art and "Scraped <date>".

## 4. Scrape a whole system (batch)

In the Library header, open **Scrape ▾** and choose **Scrape <system>…**. Or select several games
and use **Scrape n selected games…** (also in the right-click menu).

The rules start from your Settings → Scraper defaults:
- **Only missing art and fields** (on): skip art the game already has and fields that have a
  value.
- **Art kinds**, **fields** (never the title) and the **region order**.

**Start** runs in the background, one game at a time. The header shows "Scraping n/m · applied a ·
review r" with **Pause** and **Cancel scraping**.

What a batch writes on its own (D18):

| ScreenScraper finds | Result |
|---|---|
| the exact file (hash) | applied |
| one candidate, 90 % similar or more | applied |
| several candidates, or one below 90 % | **Needs review** (nothing written) |
| nothing | not found |

A batch never changes fields you edited.

### Pauses

- **Daily quota reached — resumes at <time>**: it continues on its own when ScreenScraper's
  quota resets (midnight, Paris time).
- **ScreenScraper can't be reached**: three network failures in a row. Click **Resume** when
  you're back online.
- **ScreenScraper refused the account**: fix it in **Open Settings**, then **Resume**.
- **Art couldn't be saved**: three games in a row whose art couldn't be written (e.g. an
  unplugged drive). Check the media folder, then **Resume**.

The game being scraped when it paused is done again on resume. It is never counted as failed.
Quitting the launcher mid-batch is fine: the batch carries on at the next start.

### Needs review

When the batch finishes, the header shows a summary. **Show Needs review** filters the list to
the games it couldn't match (also in the status bar's **Filter**, with a count). Scrape each one
with **Scrape…**; it leaves the list once applied.
