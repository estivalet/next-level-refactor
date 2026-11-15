# PS5 home hero redesign — design

Date: 2026-11-15 · Owner request (screenshot of a PS5-style console home) · Requirements:
FR-THM-1 (PS5 Style theme), uses FR-MUS-4 museum data · Small change · Approved by the owner,
2026-11-15.

## Intent

Make the PS5 Style home read like the owner's reference screenshot: the selected system is named
next to its tile, the hero shows who made it and when, and the system's game and favorite counts
sit at the bottom right.

## Design

1. **Label beside the selected tile.** A badge with the node's `shortName` in capitals, then the
   full name: the museum entry's `fullName` when present, else the menu label. It sits to the
   right of the selected tile, below the smaller tiles, and replaces the label under the tile. No
   `shortName` → name only.
2. **Hero.** The hero block moves right (left inset 64 px → about 140 px). Under the logo:
   `Manufacturer · Year` from the museum entry; missing parts are left out; nothing for a node
   without a `systemId`. The old count line under the logo is removed.
3. **Stats, bottom right.** "Games N" with a trophy icon and "Favorites N" ("None" at 0). Both
   come from the one game list `useGameCount` already loads (visible games; favorites = visible
   games with `favorite`). A menu node (category) shows only "Items N". Shown while loading as
   "…", hidden when the count is unknown.
4. **Unchanged.** Explore and "…" buttons, hero focus zones, museum page. Not adding the
   reference's tabs, search/settings/avatar icons.

## Approaches

- **Full name from the museum entry, falling back to the label (picked).** Gives names like
  "Nintendo Entertainment System - Famicom" the menu label lacks.
- **Label only.** Rejected: loses the fuller names the museum holds.

## Left to the builder

Exact spacing and type sizes (TV-legible, matching `ps5.css`), the trophy icon (reuse
`components/icons.tsx` if it has one, else a small inline SVG), i18n strings (en, pt-BR), test
names (`FR-THM-1: …`).
