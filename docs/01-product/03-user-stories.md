# 03 — User stories & acceptance criteria

Stories are grouped by epic and reference PRD IDs. Acceptance criteria use Given/When/Then and are
the basis for tests (see [test-strategy.md](../04-quality/test-strategy.md)). Roles: **Subscriber**,
**Newcomer** (a subscriber with no local ROMs), **Collector** (a subscriber with a large local
library), **Owner** (cabinet/family PC), **Admin**.

---

## Epic A — Sign-in & access

### US-A1 Sign in with Google · FR-AUTH-1, FR-AUTH-2
As a subscriber, I want to sign in with my Google account so I don't need another password.
- Given the launcher shows the sign-in screen, when I click **Sign in with Google**, then my default browser opens Google's consent page.
- When I approve, then the browser shows "You can return to NextLevel" and the launcher continues within 2 s.
- When I cancel or close the browser, then the launcher shows "Sign-in was cancelled" and a retry button.
- The launcher never shows a Google password field inside its own window.

### US-A2 Blocked without a subscription · FR-AUTH-3
As the operator, I want only paying users to reach the launcher.
- Given a signed-in user with no active subscription, then they see the **Subscribe** screen with plans and nothing else.
- When they complete checkout, then the launcher unlocks within 10 s without restarting.

### US-A3 Play offline · FR-AUTH-5
As a subscriber, I want to play my local games when the internet is down.
- Given my last entitlement check succeeded less than 14 days ago, when I start the launcher offline, then it opens normally and shows an "Offline" indicator.
- Given it has been more than 14 days, then it shows the sign-in screen with "Connect to the internet to continue"; my library and settings are unchanged after I reconnect.

### US-A4 Manage devices · FR-AUTH-8
As a subscriber, I want to see where I'm signed in and sign out a lost PC.
- Given my plan allows 3 devices and I have 3, when I sign in on a 4th, then I'm asked to remove one first.
- When I revoke a device, then that device is signed out at its next check.

---

## Epic B — First run

### US-B1 Start with nothing · FR-ONB-1, FR-ONB-2
As a newcomer, I want to play something without knowing what a ROM or emulator is.
- Given a fresh install, when I sign in and skip every wizard step, then I land in the catalog with a "Starter set" row.
- When I install a starter game and press Play, then it runs with the preset emulator profile; if the emulator is missing, the launcher offers to install or locate it.
- Total time from first launch to playing ≤ 5 minutes on a 50 Mbps connection (G2).

### US-B2 Point at my ROM drives · FR-ONB-1, FR-LIB-1
As a collector, I want to add my three drives in priority order during setup.
- When I add `E:\NextLevel\systems` (priority 1) and `E:\roms` (priority 2), then a scan finds games in both and shows counts per system.
- Given the same game exists on both, then the priority-1 copy is used.

### US-B3 Import my NextLevelOS setup · FR-IMP-1, FR-IMP-2
As the owner of the current NextLevelOS, I want my setup to move over without retyping.
- When I choose my old `public/data` folder, then a dry-run report lists systems, menus, collections and games found, and every item that can't map, with the reason.
- When I confirm, then the menu tree, favorites, hidden games, collections and play history match the old app.
- Re-running the import does not duplicate anything.

---

## Epic C — Browsing & playing

### US-C1 Browse with a gamepad · FR-THM-3
As an owner, I want to use the whole front-end with an Xbox controller.
- D-pad/stick moves focus; A selects; B goes back; Start opens the theme menu; Y favorites; LB/RB switch tabs.
- Holding a direction repeats after 400 ms at 10 items/s.
- Given a theme screen, then no action requires the keyboard or mouse.

### US-C2 Launch a game · FR-EMU-4, FR-EMU-6
As a subscriber, I want Play to just work.
- When I press Play on a game, then the emulator starts with that game's resolved profile within 1 s of the command being built.
- When the emulator exits, then the front-end returns focused on the same game, and play count and last played are updated.
- When the emulator fails to start, then I see the reason (missing executable, missing ROM, non-zero exit) and a **Fix in Settings** link.

### US-C3 Search everything · FR-LIB-10
- When I type "zelda" in global search, then results from all systems appear in ≤ 150 ms, ranked by title match, showing system names.

### US-C4 Favorites and hidden · FR-LIB-7
- When I favorite a game, then it appears in "Favorites" immediately and survives a restart.
- When I hide a game, then it disappears from lists except the "Hidden" tab, where I can unhide it.

### US-C10 See and change a game's collections · FR-LIB-8
- When I select a game, then its details list the collections it is in ("In no collection" when none).
- When I click a collection's remove button, then the game leaves that collection and the chip goes; the game itself stays in the library.
- When I click **Add to collection…**, then the add dialog opens for that game, and the chips follow what I tick.

### US-C5 Scrape one game · FR-SCR-1, FR-SCR-5
As a collector, I want to fix one game's art and details without leaving the launcher.
- When I choose **Scrape…** on a game, then ScreenScraper candidates appear (an exact file match first) with the best one chosen, and a preview shows each art kind and field: what I have and what ScreenScraper has.
- By default only missing art and empty fields are ticked; fields I edited myself show a lock and stay unticked unless I tick them.
- When I click **Apply**, then the art appears in the Library and every theme without a rescan, and in the same folders NextLevelOS reads.

### US-C6 Fill in a whole system · FR-SCR-2
As a collector, I want art for a whole system without clicking every game.
- When I choose **Scrape ▾ → Scrape Nintendo 64…**, pick art kinds and fields and start, then the scrape runs in the background with progress, and only fills what is missing by default.
- Only exact file matches and single confident matches (≥ 90 %) are applied; the rest are listed under **Needs review**.
- When the daily ScreenScraper quota runs out, or I quit, then the batch pauses and carries on later where it stopped.

### US-C7 Remove games I deleted · FR-LIB-14
As a collector, I want games whose files I deleted on purpose to leave the library.
- Given one or more selected games are all missing, when I choose **Remove from library…** and confirm, then they disappear from every list, search, collection and count, and stay gone after a rescan.
- When the selection has a present game, then the menu doesn't offer Remove (Hide is the way to keep a present game out of lists).
- Given the Missing tab of a system shows N games, when I choose **Remove all missing…** and confirm "Remove N missing games from the library?", then all of them are removed, and the button is gone until a game goes missing again.
- Removing never deletes or moves a file on disk.

### US-C9 See where a game's file is · FR-LIB-16
As a collector, I want to see where a game's file lives so I can find it on disk.
- When I open **Edit details**, then the last field of the Info tab shows the full path of its file (e.g. `D:\Roms\Nintendo Switch\Example Game.xci`) and I can select it. The details panel doesn't show it.
- When I click **Copy path**, then the full path is on the clipboard.
- When I click **Open folder**, then Explorer opens with the file selected.
- Given the game is missing, then the path it was expected at is shown, and Open folder opens the nearest folder that still exists.
- Neither action changes, moves or deletes anything on disk.

### US-C11 See how many games a category holds · FR-LIB-17
As a collector, I want each Library home category to show how many games it holds so I can see the size of each part of my library.
- Given a category whose systems (at any depth) have 3,800 and 12 games, then its card reads "3,812 games · N items", where N is the cards it opens to.
- Given a category holds only collections (e.g. Essentials, with "Atari 2600 Essentials" of 82 games and "Atari 5200 Essentials" of 19), then its card counts their games (101).
- Given a game is reached twice under one category (the same system twice, a system and a collection holding its games, two collections), then it counts once.
- The **Not in menu** card shows its systems' games the same way; the fixed **Collections** card reads "N collections".

### US-C12 My folders become filters · FR-LIB-18
As a collector who sorts ROMs into folders, I want a scan to turn those folders into filters so I don't tag games by hand.
- Given `Sega Game Gear\! Prototypes\Frogger (USA) (Proto).zip`, when I scan, then Frogger has the filter Prototypes (`prototype`) and the sidebar lists **Prototypes** with its count.
- Given `Sega Game Gear\Columns (USA).zip` (in no `!` or `+` folder), when I scan, then it has the filter Official.
- Given `! Hacks\! Hacks-SMW\Example Hack.zip`, then the game has both filters, and Hacks is the same filter (`hack`) as imported Hacks: the sidebar lists **Hacks** once.
- Given `! Translated\Example (Japan) (Translated En).zip` also has `translated` from the NextLevelOS import, then the sidebar counts it once under Translated.
- When I move a game's file from `! Prototypes` to the system folder and rescan, then it loses Prototypes and gains Official; filters I set in Edit details stay.
- Given a library scanned before folder filters existed, when I start the launcher, then its games have their folder filters without a rescan.
- When I add the rename Homebrews → Homebrew in Settings → Storage → Folder filters and save, then games in `! Homebrews` are under **Homebrew** at once, without a rescan.
- When I clear the outside filter and untick every prefix and save, then games lose their folder filters; their own filters stay.
- In Edit details, folder filters show as read-only chips marked "From folder"; no file on disk is changed.

### US-C13 Clean up versions of the same game · FR-LIB-19
As a collector with messy ROM folders, I want to find games I have in several versions and mark the ones to delete, so I can clean my folders by hand.
- Given `Sega Game Gear\! Translated` holds `Coca-Cola Kid [T-En by A].gg` and `Coca-Cola Kid [T-En by B].gg`, when I open Sega Game Gear in the list view, then each row shows its file under the title.
- When I open **Duplicates**, then both are listed, and so is `Coca-Cola Kid (Japan).gg` in the system folder even if its scraped title differs; a game with one version is not.
- When I mark one **Delete later** (details panel or right-click, also for a selection), then it shows a trash mark and is listed under **Delete later**; hiding it keeps it there.
- When I delete that file in Explorer and rescan, then the game moves to Missing, leaves Delete later, and its twin leaves Duplicates.
- In a collection or smart filter there is no Duplicates entry. Nothing in the launcher deletes, moves or renames a file.

### US-C8 See what a batch scrape is doing · FR-SCR-8
As a collector, I want to see exactly what a batch scrape is doing, also one that carried on from an earlier session.
- While a batch runs or is paused, the strip in the Library header names what it scrapes ("Scraping Nintendo Switch 24/753 · …", "2 systems", "selected games").
- When a batch carried on from the last session, the strip says "Resumed · started <date>" until I open its details.
- When I click the strip, then a panel opens with the job's state, when it started (and resumed), a progress bar, counts (applied with LaunchBox share, review, not found, failed, nothing to fill), the game being scraped, Pause / Resume / Cancel / Show Needs review, and the rules it was started with.
- The panel lists every game the job handled, newest first, with its outcome, source and error; chips filter by outcome; clicking a game opens it in the Library. Games handled before this feature existed aren't listed, and the panel says so.

---

## Epic D — Configuration without files

### US-D1 Add an emulator · FR-EMU-2, FR-EMU-7
As a collector, I want to set up Dolphin for GameCube without reading docs.
- When I choose **Add emulator → Dolphin preset**, then I only have to pick `Dolphin.exe`; the argument template is filled in.
- When I click **Test launch** with a GameCube game, then I see the exact command line and the emulator starts.
- Given I type an unknown token `{romm}` in a template, then Save is disabled and the field says "Unknown token {romm}".

### US-D2 Change a system's ROM folder · FR-LIB-2
- When I set Nintendo 64's folder name to `n64` and extensions to `z64, n64`, then the next scan uses them, and games already in the library keep their metadata.

### US-D7 Add a system the catalog lacks · FR-EMU-11
- When I choose **Add system** in Settings → Systems, type `Nintendo Switch 2` and `xci, nsp`, fill in its manufacturer and description and save, then it is listed as **Custom** and turned on, and a scan finds the games in each storage location's `Nintendo Switch 2` folder.
- Given a name already in use (catalog or custom), then Add says "A system with this name already exists."
- When I then choose **Scan Nintendo Switch 2** in its editor, only that system is scanned.
- When I delete it, it disappears from Settings, the library and the menu pickers; adding it again with the same name brings its games back.

### US-D8 Keep updates and DLC out of a scan · FR-LIB-15
As a collector, I want to tell a scan which files and folders of a system are not games, so updates and DLC don't show up as games.
- Given no exclusions were added, then a system scans exactly as before (no system has a default exclusion).
- When I add the pattern `*updates_dlcs` to Nintendo Switch and rescan it, then nothing in the `_review_updates_dlcs` or `updates_dlcs` folders is listed as a game, and other systems are not affected.
- When I add the pattern `*[v*` to Nintendo Switch, then `Example Game [0100000000AB0800][v65536][US].nsp` is skipped and `Example Game.xci` is still found.
- When I choose **Add folder…** and pick `D:\Roms\Nintendo Switch\updates_dlcs`, then the entry shows `updates_dlcs` and that folder is skipped in every storage location; picking a folder outside the system's ROM folder says "Pick a folder inside this system's ROM folder."
- Given an empty or repeated entry, then it can't be added.
- Given games already in the library are now excluded, when I rescan, then they are flagged missing and I can remove them with **Remove from library…** (US-C7); no file on disk is changed.
- When I remove an exclusion and rescan, then those files are found again.

### US-D3 Undo a bad change · FR-SET-3
- Given I saved settings 3 times, when I open Settings → Backups, then I see 3 backups with timestamps and can restore any of them; restoring creates a new backup of the current state first.

### US-D4 Lock the cabinet · FR-SET-6
As an owner, I want kids to play but not change settings.
- When I enable kiosk mode with PIN 1234, then the desktop, Settings and theme switcher are hidden; Start → hold 3 s → PIN unlocks them until next restart.

### US-D6 Enter my ScreenScraper account · FR-SCR-3
- When I enter my ScreenScraper user and password in Settings → Scraper and click **Test**, then I see my account name and today's request count.
- The passwords are stored in the Windows credential store, never in settings files, backups, exports or logs.

### US-D5 Edit the menu · FR-MENU-1, FR-MENU-2
- When I drag "Sega Saturn" under "Sega" and rename "Sega" to "SEGA", then all themes show the new structure immediately, and the system's games are unaffected.

---

## Epic E — Catalog

### US-E1 Browse what my plan includes · FR-CAT-1, FR-CAT-2
- Given my plan includes "Homebrew – 8-bit", then I see those items and not items from other scopes.
- Each item shows its license (e.g. "Freeware, © Author, distributed with permission").

### US-E2 Install a game · FR-CAT-3, FR-CAT-4
- When I click Install, then the download appears in the queue with progress and can be paused/resumed across restarts.
- When the download finishes and the checksum matches, then the game appears in its system with art and metadata.
- When the checksum fails, then the file is deleted and the item shows "Download corrupted — retry".

### US-E3 Uninstall · FR-CAT-5
- When I uninstall a catalog game, then its files and library entry are removed; my favorites/collections entries for it are removed after confirmation.

---

## Epic F — Admin

### US-F1 Publish a homebrew game · FR-ADM-3, FR-CAT-8
As an admin, I want to add a game whose author gave permission.
- When I create an item without a license record, then **Publish** is disabled with "License required".
- When I upload the ROM, then its SHA-256 and size are computed and stored.
- When I publish, then subscribers whose plans include the item's scope see it within 1 minute.

### US-F2 Give a tester free access · FR-SUB-4
- When I grant a complimentary plan to `tester@gmail.com` until 2027-01-31, then that user can use the launcher without paying, and access ends on that date.

### US-F3 Suspend abuse · FR-AUTH-7, FR-ADM-5
- When I suspend a user, then their launcher locks at its next check (≤ 1 h online) and the audit log records who suspended them and why.

### US-F4 Manage plans · FR-SUB-1, FR-ADM-2
- When I change a plan's catalog scopes, then subscribers on that plan see the change within 1 minute; archived plans stay valid for existing subscribers but can't be chosen by new ones.

---

## Epic G — Systems museum

### US-G1 Browse a system's history from the couch · FR-MUS-1, FR-MUS-4, FR-MUS-5
As a collector, I want to read about a console while I browse it.
- When I press I on a focused system, or choose the "…" button next to Explore on the PS5 home (Down from the shelf, then Right), then the info page opens;
  when I open the info page of a focused system, then I see its overview, story, hardware, models, related systems and top games, and a Sources line crediting where the facts came from.
- When I pick a top game I own, then it launches; a top game I don't own is shown but not launchable.

### US-G2 Curate a system's museum entry · FR-MUS-2, FR-MUS-3
- When I edit a system's entry in the Museum app and save, then themes show my version, and **Reset** brings back the shipped one.
- When I add a top game by title, then it is marked owned if a present game of that system has the same normalized title, or if I pinned it to a library game.

### US-G3 Keep my own emulation notes and pictures for a system · FR-MUS-6..9
- When I write notes for a system in the Museum app and save, then they are kept apart from the museum entry, and **Reset to original** does not clear them.
- When I open a system, then I see the emulators set up for it, grouped by emulator, and cannot change them there.
- When I add images to a system's gallery, then they are copied into the launcher's data folder; I can caption, reorder and remove them, and discarding the edit removes the copies I had just added.
- When I open the Museum, then Home is the first menu item, showing a welcome with my museum picture, the systems I changed recently and the ones with my notes; Save and Discard stay pinned to the bottom of the window while I edit.

### US-G4 Classify my systems myself, telling virtual systems from real hardware · FR-MUS-10
- When I edit a system in the Museum, then Overview starts with a **Type** I can change, including **Virtual system** for emulators and engines such as AAE or ScummVM.
- When I save a Type, then the Museum list and its Type filter use it, and a virtual system's row shows a **Virtual** badge.
- When I press **Reset to original**, then the shipped Type comes back with the rest of the entry.
