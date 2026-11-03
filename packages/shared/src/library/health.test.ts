import { describe, expect, it } from 'vitest';
import {
  HEALTH_FIELDS,
  HEALTH_GAPS,
  healthScore,
  SystemHealthSchema,
  type SystemHealth,
} from './health.ts';

function system(games: number, lacking: Partial<SystemHealth['lacking']> = {}): SystemHealth {
  const none = Object.fromEntries(HEALTH_GAPS.map((gap) => [gap, 0])) as SystemHealth['lacking'];
  return { systemId: 'gce-vectrex', games, lacking: { ...none, ...lacking } };
}

describe('system health (owner request 2026-11-02)', () => {
  it('a system with every ROM, the graded art and every detail is 100, A', () => {
    expect(healthScore(system(10))).toEqual({ rom: 1, art: 1, details: 1, score: 100, grade: 'A' });
  });

  it('the score averages ROMs found, graded art and details', () => {
    // ROMs 9/10; art: box front 5/10, screenshot and logo full = 5/6; details: description 0/10 = 5/6.
    const score = healthScore(system(10, { rom: 1, 'art:box-front': 5, 'field:description': 10 }));
    expect(score.rom).toBeCloseTo(0.9);
    expect(score.art).toBeCloseTo(5 / 6);
    expect(score.details).toBeCloseTo(5 / 6);
    expect(score.score).toBe(86);
    expect(score.grade).toBe('B');
  });

  it('video and the other art kinds are gaps but never lower the grade', () => {
    expect(healthScore(system(10, { 'art:video': 10, 'art:fanart': 10 })).score).toBe(100);
  });

  it('grade bands: A ≥ 90, B ≥ 75, C ≥ 50, D ≥ 25, else F', () => {
    const at = (rom: number) => healthScore(system(100, { rom: 100 - rom })).grade;
    // Art and details are full (2/3 of the score), so the ROM share moves the score by thirds.
    expect(at(70)).toBe('A'); // 90
    expect(at(25)).toBe('B'); // 75
    expect(healthScore(system(4, { rom: 4, 'art:box-front': 4, 'art:logo-clear': 2 })).grade).toBe(
      'C',
    ); // (0 + 0.5 + 1) / 3 = 50
    // ROMs 0, art full, details none = 1/3 → 33.
    expect(
      healthScore(
        system(4, {
          rom: 4,
          ...Object.fromEntries(HEALTH_FIELDS.map((field) => [`field:${field}`, 4])),
        }),
      ).grade,
    ).toBe('D');
    expect(
      healthScore(
        system(4, {
          rom: 4,
          'art:box-front': 4,
          ...Object.fromEntries(HEALTH_FIELDS.map((field) => [`field:${field}`, 4])),
        }),
      ).grade,
    ).toBe('F'); // (0 + 2/3 + 0) / 3 = 22
  });

  it('a system with nothing found is 0, F', () => {
    const lacking = Object.fromEntries(HEALTH_GAPS.map((gap) => [gap, 3]));
    expect(healthScore(system(3, lacking))).toMatchObject({ score: 0, grade: 'F' });
  });

  it('the IPC shape needs a count for every gap', () => {
    expect(SystemHealthSchema.safeParse(system(1)).success).toBe(true);
    expect(SystemHealthSchema.safeParse({ systemId: 'x', games: 1, lacking: {} }).success).toBe(
      false,
    );
  });
});
