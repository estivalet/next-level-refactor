# Catalog fixtures (test-strategy §2)

Five made-up homebrew items (`make.ts`) for catalog, upload and download tests. Their files are
**generated dummy bytes** (a text header, then xorshift noise): no ROM, BIOS or game data of any
kind is committed or used. `manifest.json` pins each file's size and SHA-256;
`src/catalog/fixtures.test.ts` checks the generator still matches it.

Titles, studios and contacts are invented (`*@example.test`).
