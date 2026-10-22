import { describe, expect, it } from 'vitest';
import { matchMedia } from './media.ts';

const file = (kind: string, path: string, size = 10) => ({ kind, path, size });

describe('matchMedia', () => {
  it('FR-THM-2: a media file matches the game with the same file stem', () => {
    const rows = matchMedia(
      [
        { id: 1, relPath: 'Sonic (USA).md' },
        { id: 2, relPath: 'Other.md' },
      ],
      [file('box-front', 'E:\\roms\\sega\\media\\box-front\\Sonic (USA).png')],
    );
    expect(rows).toEqual([
      {
        gameId: 1,
        kind: 'box-front',
        path: 'E:\\roms\\sega\\media\\box-front\\Sonic (USA).png',
        size: 10,
      },
    ]);
  });

  it('FR-THM-2: kinds and stems ignore case; bad kind folders are skipped', () => {
    const rows = matchMedia(
      [{ id: 1, relPath: 'sonic.md' }],
      [
        file('Box-Front', 'C:\\m\\Box-Front\\SONIC.PNG'),
        file('fan art', 'C:\\m\\fan art\\sonic.jpg'),
      ],
    );
    expect(rows.map((r) => r.kind)).toEqual(['box-front']);
  });

  it('FR-THM-2: one file per kind, preferring png over jpg and mp4 over webm', () => {
    const rows = matchMedia(
      [{ id: 1, relPath: 'Game.zip' }],
      [
        file('box-front', 'C:\\m\\box-front\\Game.jpg'),
        file('box-front', 'C:\\m\\box-front\\Game.png'),
        file('video', 'C:\\m\\video\\Game.webm'),
        file('video', 'C:\\m\\video\\Game.mp4'),
      ],
    );
    expect(rows.map((r) => r.path).sort()).toEqual([
      'C:\\m\\box-front\\Game.png',
      'C:\\m\\video\\Game.mp4',
    ]);
  });

  it('FR-THM-2: a game in a sub-folder matches by its own file stem', () => {
    const rows = matchMedia(
      [{ id: 7, relPath: 'discs/FF7 (Disc 1).chd' }],
      [file('box-front', 'C:\\m\\box-front\\FF7 (Disc 1).png')],
    );
    expect(rows).toHaveLength(1);
  });

  it('FR-THM-2: files with no extension or an unknown one are ignored', () => {
    const rows = matchMedia(
      [{ id: 1, relPath: 'Game.zip' }],
      [
        file('box-front', 'C:\\m\\box-front\\Game'),
        file('box-front', 'C:\\m\\box-front\\Game.txt'),
      ],
    );
    expect(rows).toEqual([]);
  });
});
