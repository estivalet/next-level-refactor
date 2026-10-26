import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function boundaryErrors(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}/${file}` });
  return (result?.messages ?? [])
    .filter(
      (m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'import/no-restricted-paths',
    )
    .map((m) => m.message);
}

// The first lint builds the TypeScript program for type-aware rules, which can take several
// seconds on a CI runner; do it once here so each test only measures its own lint.
beforeAll(async () => {
  await boundaryErrors('packages/shared/src/index.ts', '');
  await boundaryErrors('apps/launcher/src/renderer/main.tsx', '');
}, 60_000);

describe('architecture §3 dependency rule', () => {
  it.each([
    "import '@nextlevel/api';",
    "import '@nextlevel/launcher';",
    "import '@nextlevel/admin/src/index.ts';",
    "import '../../../apps/api/src/app.ts';",
  ])('packages never import apps: %s', async (code) => {
    expect(await boundaryErrors('packages/shared/src/index.ts', code)).toHaveLength(1);
    expect(await boundaryErrors('packages/ui/src/index.ts', code)).toHaveLength(1);
  });

  it.each([
    "import 'node:fs';",
    "import 'fs';",
    "import 'electron';",
    "import 'http';",
    "import 'node:stream';",
  ])('themes and ui never import Node or Electron: %s', async (code) => {
    expect(await boundaryErrors('packages/themes/src/index.ts', code)).toHaveLength(1);
    expect(await boundaryErrors('packages/ui/src/index.ts', code)).toHaveLength(1);
  });

  it.each(["import 'electron';", "import 'node:fs';", "import 'http';"])(
    'NFR-SEC-1: the renderer never imports Node or Electron: %s',
    async (code) => {
      expect(await boundaryErrors('apps/launcher/src/renderer/main.tsx', code)).toHaveLength(1);
    },
  );

  it('the renderer may import shared packages', async () => {
    const code = "import '@nextlevel/shared';";
    expect(await boundaryErrors('apps/launcher/src/renderer/main.tsx', code)).toEqual([]);
  });

  it('packages may import other packages, including subpaths', async () => {
    const code = "import '@nextlevel/shared/i18n/en.json';";
    expect(await boundaryErrors('packages/ui/src/index.ts', code)).toEqual([]);
  });

  it('apps may import packages', async () => {
    expect(await boundaryErrors('apps/api/src/index.ts', "import '@nextlevel/shared';")).toEqual(
      [],
    );
  });
});
