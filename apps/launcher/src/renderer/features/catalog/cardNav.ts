/**
 * Moves focus across catalog cards (S8, D47): left/right within a row, up/down to the row above
 * or below at the same position (or its last card). Rows are `[data-card-row]`, cards
 * `[data-card]`. Answers whether focus moved.
 */
export function moveCardFocus(
  container: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
): boolean {
  const rows = [...container.querySelectorAll<HTMLElement>('[data-card-row]')]
    .map((row) => [...row.querySelectorAll<HTMLElement>('[data-card]')])
    .filter((cards) => cards.length > 0);
  const active = document.activeElement;
  let rowIndex = rows.findIndex((cards) => cards.some((card) => card === active));
  if (rowIndex < 0) {
    rows[0]?.[0]?.focus();
    return rows.length > 0;
  }
  let cardIndex = rows[rowIndex]?.findIndex((card) => card === active) ?? 0;
  if (direction === 'left') cardIndex -= 1;
  if (direction === 'right') cardIndex += 1;
  if (direction === 'up') rowIndex -= 1;
  if (direction === 'down') rowIndex += 1;
  const row = rows[rowIndex];
  if (!row) return false;
  const target = row[Math.max(0, Math.min(cardIndex, row.length - 1))];
  if (!target || target === active) return false;
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}
