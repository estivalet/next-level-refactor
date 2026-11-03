import { describe, expect, it } from 'vitest';
import { lbValues, selectArt } from './mapping.ts';
import type { LbGame, LbImage } from './parseMetadata.ts';

const ACE: LbImage[] = [
  { fileName: 'logo.png', type: 'Clear Logo', region: null },
  { fileName: 'bg.jpg', type: 'Fanart - Background', region: null },
  { fileName: 'fan-box.png', type: 'Fanart - Box - Front', region: null },
  { fileName: 'fan-box-world.png', type: 'Fanart - Box - Front', region: 'World' },
];

const DRACULA: LbImage[] = [
  { fileName: 'dracula-na.jpg', type: 'Box - Front', region: 'North America' },
  { fileName: 'dracula-eu.jpg', type: 'Box - Front', region: 'Europe' },
];

describe('LaunchBox art and fields (FR-SCR-6)', () => {
  it('maps each kind to its first available type, region by priority', () => {
    const art = selectArt(ACE, ['us', 'eu', 'wor', 'jp']);
    // No Box - Front: the Fanart - Box - Front fallback; World beats no region only by order.
    expect(art['box-front']?.fileName).toBe('fan-box.png');
    expect(art['logo-clear']?.fileName).toBe('logo.png');
    expect(art.fanart?.fileName).toBe('bg.jpg');
    expect(art['box-back']).toBeUndefined();
    expect(art.video).toBeUndefined();
  });

  it('picks the region the priority prefers, else the first image of the type', () => {
    expect(selectArt(DRACULA, ['eu', 'us'])['box-front']?.fileName).toBe('dracula-eu.jpg');
    expect(selectArt(DRACULA, ['us'])['box-front']?.fileName).toBe('dracula-na.jpg');
    expect(selectArt(DRACULA, ['jp'])['box-front']?.fileName).toBe('dracula-na.jpg');
  });

  it('a Box - Front beats a reconstructed one and fan art', () => {
    const art = selectArt(
      [
        { fileName: 'fan.png', type: 'Fanart - Box - Front', region: null },
        { fileName: 'rec.png', type: 'Box - Front - Reconstructed', region: null },
        { fileName: 'real.png', type: 'Box - Front', region: 'Japan' },
      ],
      ['us'],
    );
    expect(art['box-front']?.fileName).toBe('real.png');
  });

  it('maps fields to the library columns', () => {
    const game: LbGame = {
      id: 472523,
      name: 'Ace Driver Collection',
      platform: 'Microsoft Xbox 360',
      year: 2026,
      developer: 'Wans Zai',
      publisher: 'Project Aces',
      genres: 'Racing; Action',
      players: '1',
      overview: 'Three racers.',
      rating: 4.3,
    };
    expect(lbValues(game)).toEqual({
      title: 'Ace Driver Collection',
      description: 'Three racers.',
      year: 2026,
      developer: 'Wans Zai',
      publisher: 'Project Aces',
      genre: 'Racing; Action',
      players: '1',
      rating: 4.3,
    });
  });
});
