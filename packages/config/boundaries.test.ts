import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

describe('architecture §3 dependency rule', () => {
  it.each([
    "import '@nextlevel/api';",
    "import '@nextlevel/launcher';",
    "import '@nextlevel/admin/src/index.ts';",
    "import '../../../apps/api/src/index.ts';",
  ])('packages never import apps: %s', async (code) => {
    expect(await boundaryErrors('packages/shared/src/index.ts', code)).toHaveLength(1);
    expect(await boundaryErrors('packages/ui/src/index.ts', code)).toHaveLength(1);
  });

  it.each(["import 'node:fs';", "import 'fs';", "import 'electron';"])(
    'themes and ui never import Node or Electron: %s',
    async (code) => {
      expect(await boundaryErrors('packages/themes/src/index.ts', code)).toHaveLength(1);
    },
  );

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
