import type { CleanupGame } from './cleanupFiles.ts';

export interface CleanupScriptMeta {
  /** The scope's name as shown. */
  scope: string;
  /** ISO time of the export. */
  exportedAt: string;
  /** The launcher-language string for an i18n key (`mainText` bound to the language). */
  text: (key: string) => string;
}

const KEY = 'library.cleanup.script.';
/** Windows PowerShell 5.1 reads a script as UTF-8 only with it. */
const BOM = String.fromCharCode(0xfeff);

/** PowerShell single-quoted literal: `'` and the curly quotes PowerShell also accepts are doubled. */
export function psQuote(value: string): string {
  return `'${value.replace(/['‘’‚‛]/g, (quote) => quote + quote)}'`;
}

/** Comment text on one line: CR/LF can't start a new script line. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ');

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${String(value)} B` : `${value.toFixed(1)} ${units[unit] ?? ''}`;
}

/**
 * The helper every file line calls. Recycles only on local fixed drives: elsewhere (network,
 * USB sticks) the VisualBasic call would delete for good, so the file is skipped, before the
 * drive is even touched.
 */
function helper(t: (name: string) => string): string[] {
  const msg = (name: string) => psQuote(t(name));
  return [
    'param([switch]$DryRun)',
    '',
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    '$script:recycled = 0; $script:gone = 0; $script:skipped = 0',
    '',
    'function Test-RecycleBin([string]$Path) {',
    '  try {',
    '    $root = [System.IO.Path]::GetPathRoot($Path)',
    "    if (-not $root -or $root.StartsWith('\\\\')) { return $false }",
    '    return ([System.IO.DriveInfo]::new($root)).DriveType -eq [System.IO.DriveType]::Fixed',
    '  } catch { return $false }',
    '}',
    '',
    'function Remove-ToRecycleBin([string]$Path, [switch]$Folder) {',
    '  if (-not (Test-RecycleBin $Path)) {',
    `    Write-Host (${msg('skipped')} -f $Path, ${msg('noBin')}); $script:skipped++; return`,
    '  }',
    '  if (-not (Test-Path -LiteralPath $Path)) {',
    `    Write-Host (${msg('gone')} -f $Path); $script:gone++; return`,
    '  }',
    `  if ($DryRun) { Write-Host (${msg('would')} -f $Path); return }`,
    '  try {',
    "    $ui = 'OnlyErrorDialogs'",
    "    if ($Folder) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($Path, $ui, 'SendToRecycleBin') }",
    "    else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($Path, $ui, 'SendToRecycleBin') }",
    `    Write-Host (${msg('recycled')} -f $Path); $script:recycled++`,
    '  } catch {',
    `    Write-Host (${msg('skipped')} -f $Path, $_.Exception.Message); $script:skipped++`,
    '  }',
    '}',
  ];
}

/**
 * The Delete later cleanup script (FR-LIB-20, US-C14): a header, a Recycle Bin helper, then per
 * game a title comment and one line per file. UTF-8 with BOM (Windows PowerShell 5.1 reads
 * names with accents only then) and CRLF.
 */
export function renderCleanupScript(
  games: readonly CleanupGame[],
  meta: CleanupScriptMeta,
): string {
  const t = (name: string) => meta.text(KEY + name);
  const files = games.flatMap((game) => game.files);
  const size = files.reduce((total, entry) => total + entry.size, 0);
  const out: string[] = [
    `# ${oneLine(fill(t('title'), { scope: meta.scope, date: meta.exportedAt }))}`,
    `# ${fill(t('summary'), { games: games.length, files: files.length, size: formatSize(size) })}`,
    `# ${t('how')}`,
    ...helper(t),
  ];
  for (const game of games) {
    out.push('', `# ${oneLine(`${game.title} · ${game.system}`)}`);
    if (game.files.length === 0 && game.notes.length === 0) out.push(`# ${t('noFiles')}`);
    for (const entry of game.files) {
      const call = `Remove-ToRecycleBin ${psQuote(entry.path)}${entry.folder ? ' -Folder' : ''}`;
      out.push(`${call}  # ${oneLine(entry.location)}`);
    }
    for (const note of game.notes) {
      out.push(`# ${oneLine(fill(t(note.kind), { path: note.path }))}`);
    }
  }
  out.push(
    '',
    `if ($DryRun) { Write-Host ${psQuote(t('dryRun'))} }`,
    `Write-Host (${psQuote(t('total'))} -f $script:recycled, $script:gone, $script:skipped)`,
    '',
  );
  return BOM + out.join('\r\n');
}
