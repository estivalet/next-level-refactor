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

### US-C5 Scrape one game · FR-SCR-1, FR-SCR-5 *(proposed, D20)*
As a collector, I want to fix one game's art and details without leaving the launcher.
- When I choose **Scrape…** on a game, then ScreenScraper candidates appear (an exact file match first) with the best one chosen, and a preview shows each art kind and field: what I have and what ScreenScraper has.
- By default only missing art and empty fields are ticked; fields I edited myself show a lock and stay unticked unless I tick them.
- When I click **Apply**, then the art appears in the Library and every theme without a rescan, and in the same folders NextLevelOS reads.

### US-C6 Fill in a whole system · FR-SCR-2 *(proposed, D20)*
As a collector, I want art for a whole system without clicking every game.
- When I choose **Scrape ▾ → Scrape Nintendo 64…**, pick art kinds and fields and start, then the scrape runs in the background with progress, and only fills what is missing by default.
- Only exact file matches and single confident matches (≥ 90 %) are applied; the rest are listed under **Needs review**.
- When the daily ScreenScraper quota runs out, or I quit, then the batch pauses and carries on later where it stopped.

---

## Epic D — Configuration without files

### US-D1 Add an emulator · FR-EMU-2, FR-EMU-7
As a collector, I want to set up Dolphin for GameCube without reading docs.
- When I choose **Add emulator → Dolphin preset**, then I only have to pick `Dolphin.exe`; the argument template is filled in.
- When I click **Test launch** with a GameCube game, then I see the exact command line and the emulator starts.
- Given I type an unknown token `{romm}` in a template, then Save is disabled and the field says "Unknown token {romm}".

### US-D2 Change a system's ROM folder · FR-LIB-2
- When I set Nintendo 64's folder name to `n64` and extensions to `z64, n64`, then the next scan uses them, and games already in the library keep their metadata.

### US-D3 Undo a bad change · FR-SET-3
- Given I saved settings 3 times, when I open Settings → Backups, then I see 3 backups with timestamps and can restore any of them; restoring creates a new backup of the current state first.

### US-D4 Lock the cabinet · FR-SET-6
As an owner, I want kids to play but not change settings.
- When I enable kiosk mode with PIN 1234, then the desktop, Settings and theme switcher are hidden; Start → hold 3 s → PIN unlocks them until next restart.

### US-D6 Enter my ScreenScraper account · FR-SCR-3 *(proposed, D20)*
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
