# Catalog guide

How the online catalog works in NextLevel (M9): what players see in the launcher, and how an
admin publishes, updates and takes down a game in the console. Every game in the catalog needs a
verified license first ([content policy](../06-legal/content-policy.md), ADR-012). Files are
stored on the API machine's disk until M10 (`FILES_DIR`, D40).

## For players (the launcher)

### Finding games

Open **Catalog** from the desktop or the Start menu. **Browse** shows:

- **Starter set**: games picked for new players, if your plan has any.
- **New**: the latest games published.
- A row per system.

Type in the search box, or pick a System or Genre, to see Results instead. Arrow keys and a
gamepad move across the games; Enter (or A) opens one.

A game's page shows its description, screenshots, size and its license credit, for example
"License: Freeware · © Pixel Moth". The catalog only lists games your plan includes.

### Installing, updating, uninstalling

- **Install** queues a download. Downloads run one at a time and show in **Downloads** (and in
  the taskbar tray: how many, and how far along). Pause, Resume and Cancel are there; a download
  that was running when you quit continues next time from where it stopped. If the connection
  drops, it waits and goes on by itself.
- Every file is checked when it arrives. "Download corrupted — retry" means a file didn't match:
  it was deleted, and Retry downloads it again.
- The game goes to the **Catalog games** folder (Settings → Storage; by default `Catalog` in
  your NextLevel folder), with its art and details, and appears in the Library like any game.
- **Update** appears when a newer version is published. Nothing updates without you.
- **Uninstall** deletes only the files the catalog installed. It asks first when the game is a
  favorite or in a collection. Your own ROMs are never touched.

**Installed** lists your catalog games and works offline. The catalog itself needs a connection
("Catalog needs a connection — installed games still play").

### When a game leaves the catalog

A game can leave the catalog: unpublished, its license ended, or no longer in your plan. Each game
says what happens then:

- **Keep**: it stays installed and playable, marked "No longer in the catalog".
- **Remove**: it is uninstalled the next time NextLevel checks your account online (at start and
  every hour), and a notice by the tray lists the games removed.

If your subscription lapses, the launcher locks until you subscribe again; nothing is removed.

## For admins (the console)

### Publishing a game

1. **Catalog → New item**: slug (fixed after creation; it names the game's folder on players'
   PCs), title, system, scope (which plans see it).
2. **Metadata**: description, year, players, developer, publisher, genre.
3. **Files**: pick the role (ROM, Disc, Extra) and upload. The API computes the size and SHA-256
   and shows them. A name the system can't use is refused before anything is sent. Uploading a
   file with the same name replaces it.
4. **Art**: one image or video per kind (box front, screenshots, logo…).
5. **License**: type, rights holder, contact, terms, optional territories and dates. Upload the
   evidence (the permission document), then **Mark verified**: it stays disabled until there is
   evidence, and records who verified it and when.
6. **Publish** tab: choose **When it leaves the catalog** (Keep or Remove; there is no default),
   tick **Starter set** if new players should see it first, and **Publish**. Publish stays
   disabled until nothing blocks it, and every blocker is named: license required, not verified,
   not started yet, expired; the leave-the-catalog choice; a ROM or disc file.

Every change is in the audit log.

### Updating a published game

Replacing, adding or removing a file on a published game bumps its version; players see
**Update available**. Replace and Remove ask first. A published game always keeps at least one
ROM or disc file. Changing its scope asks first too: players outside the new scope lose it
(kept or removed by its rule).

Saving a new license on a published game unpublishes it until the new license is verified (the
page warns and asks first). A license that expires unpublishes its game automatically within the
hour, with "System" as the actor in the audit log.

### Taking a game down

**Publish** tab → set **When it leaves the catalog** to **Remove** → **Unpublish**. New downloads
stop at once; installed copies are deleted at each launcher's next online check. The full
runbook is in [deployment and operations](../05-operations/deployment-and-operations.md#remove-a-catalog-item-urgently-takedown).

### The dashboard

The console opens on the **Dashboard**:

- Active subscribers (paying and complimentary).
- MRR per currency.
- Downloads in the last 7 days, and a 30-day chart with a table view.
- The top items.
- The latest sign-ups.
- Failed payments.

The numbers are computed when the page loads.
