/** Rows per `library.games.list` request; the list only asks for pages it shows (NFR-PERF-2). */
export const PAGE_SIZE = 200;

/** The page indexes covering rows `first..last`; page 0 when nothing is visible yet. */
export function pagesForRange(first: number, last: number, pageSize = PAGE_SIZE): number[] {
  if (last < first) return [0];
  const pages: number[] = [];
  for (let page = Math.floor(first / pageSize); page <= Math.floor(last / pageSize); page += 1) {
    pages.push(page);
  }
  return pages;
}
