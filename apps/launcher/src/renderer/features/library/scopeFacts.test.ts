import { describe, expect, it } from 'vitest';
import { leavesTab } from './scopeFacts.ts';

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
