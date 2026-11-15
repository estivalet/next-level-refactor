# Search within the open list, and visible dialog fields — design

Date: 2026-11-14 · Owner request (screenshots: Edit details, Arcade with 4116 games) · Requirement:
FR-LIB-10 (search), FR-LIB-6 (edit metadata) · Decision D66 · Small change

## Intent

1. In a scope with thousands of games (Arcade: 4116) the owner wants to search **only that list**;
   the top box searches all games.
2. In Edit details (and the other Library dialogs) empty fields are barely visible: their border is
   10% white on a dark background. Only the focused field shows (green border).

## Design (approved by the owner, 2026-11-14)

**Search within the list.**
- A small search box in the list header, next to Export…, placeholder "Search <scope name>…".
- Typing narrows the open scope's list with the same matching as global search. The backend
  already supports this: `GameListQuery.text`, an FTS match within the scope. The box is
  debounced like global search.
- The header count reads "<n> of <total> games" while text is entered.
- It combines with the tab, Filters, Genres and Essentials only. It clears when another scope
  opens, like the other narrowing.
- Export… exports what is shown: `ExportView` gains `text`.
- The sidebar counts (tabs, filters, genres, Essentials) stay scope-wide (my call: they describe
  the scope and would jump with every key).
- The global search box is unchanged.

**Visible fields.** The Library dialogs' shared input style (`Modal.tsx` `INPUT`) gets a border
around 25% white instead of 10%. The focus and invalid borders stay. Settings fields are left as
they are unless the owner asks.

## Approaches

- **A box in the list header (picked).** It reuses the existing in-scope query, so it is UI only,
  plus `text` on the export view.
- **Make the top box search the open scope when one is open.** Rejected: it would lose the global
  search the owner still wants, and one box doing two things is confusing.

## Non-goals

Search inside the theme front-ends; changing the global search; filtering the sidebar counts.

## Left to the builder

The exact debounce (reuse `useDebounced`), the box's width, the strings in en and pt-BR, and the
test names (`FR-LIB-10: …`, `FR-LIB-6: …`).
