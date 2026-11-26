import { describe, expect, it } from 'vitest';
import { leavesTab, scopeTitle } from './scopeFacts.ts';
import type { LibraryView } from './useLibraryView.ts';

function viewOf(scope: LibraryView['scope']): LibraryView {
  return {
    scope,
    systems: { data: [{ id: 'gamegear', enabled: true, games: 2, missing: 0, review: 0 }] },
    catalog: { data: [{ id: 'gamegear', name: 'Sega Game Gear' }] },
    collections: { data: [{ id: 1, name: 'Picks', sort: 'title', games: 2 }] },
    smartFilters: { data: [] },
  } as unknown as LibraryView;
}

describe('scopeTitle', () => {
  it("FR-LIB-20: the scope's name as the list header shows it", () => {
    expect(scopeTitle(viewOf({ kind: 'system', systemId: 'gamegear' }))).toBe('Sega Game Gear');
    expect(scopeTitle(viewOf({ kind: 'system', systemId: 'custom-x' }))).toBe('custom-x');
    expect(scopeTitle(viewOf({ kind: 'collection', collectionId: 1 }))).toBe('Picks');
    expect(scopeTitle(viewOf({ kind: 'smartFilter', smartFilterId: 9 }))).toBe('');
    expect(scopeTitle(viewOf(null))).toBe('');
  });
});

describe('leavesTab', () => {
  it('D60: un-completing leaves the Completed tab; hiding leaves every tab but Hidden', () => {
    expect(leavesTab('completed', { completed: false })).toBe(true);
    expect(leavesTab('completed', { completed: true })).toBe(false);
    expect(leavesTab('all', { completed: false })).toBe(false);
    expect(leavesTab('completed', { hidden: true })).toBe(true);
    expect(leavesTab('favorites', { favorite: false })).toBe(true);
  });

  it('US-C13: hiding a game keeps it in Delete later; unmarking leaves', () => {
    expect(leavesTab('deleteLater', { hidden: true })).toBe(false);
    expect(leavesTab('deleteLater', { deleteLater: false })).toBe(true);
    expect(leavesTab('deleteLater', { deleteLater: true })).toBe(false);
    expect(leavesTab('all', { deleteLater: true })).toBe(false);
  });
});
