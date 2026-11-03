import { describe, expect, it } from 'vitest';
import { buildPrompt, parseReply, responseSchema, type PromptGame } from './prompt.ts';

const tennis: PromptGame = {
  gameId: 7,
  system: 'Coleco Telstar',
  title: 'Tennis',
  file: 'tennis.bat',
  known: { year: 1976 },
};

describe('Gemini prompt (FR-SCR-7)', () => {
  it('FR-SCR-7: names each game with its system, title, file and known details', () => {
    const prompt = buildPrompt([tennis], ['developer', 'description'], 'Brazilian Portuguese');
    expect(prompt).toContain('Coleco Telstar');
    expect(prompt).toContain('"gameId": 7');
    expect(prompt).toContain('Tennis');
    expect(prompt).toContain('tennis.bat');
    expect(prompt).toContain('"year": 1976');
    expect(prompt).toContain('Brazilian Portuguese');
  });

  it('FR-SCR-7: tells Gemini to never guess and to echo the gameId', () => {
    const prompt = buildPrompt([tennis], ['year'], 'English');
    expect(prompt).toContain('never guess; a wrong value is worse than none');
    expect(prompt).toContain('gameId');
    expect(prompt).toMatch(/known.*false/);
  });

  it('FR-SCR-7: asks only the requested fields (plus the title suggestion)', () => {
    const prompt = buildPrompt([tennis], ['year'], 'English');
    expect(prompt).toContain('"year"');
    expect(prompt).not.toContain('"publisher"');
    expect(prompt).toContain('"title"');
    const schema = JSON.stringify(responseSchema(['year']));
    expect(schema).toContain('year');
    expect(schema).toContain('gameId');
    expect(schema).not.toContain('publisher');
  });
});

describe('parseReply (FR-SCR-7)', () => {
  it('FR-SCR-7: reads a JSON array from code fences or prose', () => {
    expect(parseReply('```json\n[{"gameId":1}]\n```')).toEqual([{ gameId: 1 }]);
    expect(parseReply('Here you go:\n[{"gameId":1}]\nHope it helps!')).toEqual([{ gameId: 1 }]);
    expect(parseReply('[{"gameId":1}]')).toEqual([{ gameId: 1 }]);
  });

  it('FR-SCR-7: no JSON array is null, never a throw', () => {
    expect(parseReply('no json here')).toBeNull();
    expect(parseReply('[{"gameId": 1,')).toBeNull();
    expect(parseReply('{"gameId": 1}')).toBeNull();
    expect(parseReply('')).toBeNull();
  });
});
