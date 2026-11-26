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
 * The shell's own Recycle Bin call. FOF_WANTNUKEWARNING makes Windows ask before anything would
 * be deleted for good (too big for the bin, bin turned off, subst drive, junction to a stick);
 * answering No aborts, and the file is reported as skipped. (The VisualBasic FileSystem call
 * answers that question with yes on its own.)
 */
const RECYCLER = [
  "Add-Type -TypeDefinition @'",
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class NextLevelRecycler {',
  '  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
  '  struct SHFILEOPSTRUCT {',
  '    public IntPtr hwnd; public uint wFunc; public string pFrom; public string pTo;',
  '    public ushort fFlags; public bool fAnyOperationsAborted;',
  '    public IntPtr hNameMappings; public string lpszProgressTitle;',
  '  }',
  '  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]',
  '  static extern int SHFileOperation(ref SHFILEOPSTRUCT op);',
  '  const uint FO_DELETE = 3;',
  '  const ushort FOF_NOCONFIRMATION = 0x10, FOF_ALLOWUNDO = 0x40, FOF_NOERRORUI = 0x400;',
  '  const ushort FOF_WANTNUKEWARNING = 0x4000;',
  '  /// 0 = recycled; -1 = aborted (nothing deleted for good); else the shell error code.',
  '  public static int Recycle(string path) {',
  '    var op = new SHFILEOPSTRUCT();',
  '    op.wFunc = FO_DELETE;',
  // The shell wants a double-NUL-terminated list; C# sees the escapes, not NUL characters.
  '    op.pFrom = path + "\\0\\0";',
  '    op.fFlags = (ushort)(FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_WANTNUKEWARNING | FOF_NOERRORUI);',
  '    int result = SHFileOperation(ref op);',
  '    if (result != 0) return result;',
  '    return op.fAnyOperationsAborted ? -1 : 0;',
  '  }',
  '}',
  "'@",
];

/**
 * The helper every file line calls. Recycles only on local fixed drives (network shares and USB
 * sticks have no Recycle Bin), checked before the drive is even touched; anywhere Windows still
 * can't recycle, it asks first (see RECYCLER).
 */
function helper(t: (name: string) => string): string[] {
  const msg = (name: string) => psQuote(t(name));
  return [
    'param([switch]$DryRun)',
    '',
    ...RECYCLER,
    '$script:recycled = 0; $script:gone = 0; $script:skipped = 0',
    '',
    'function Test-RecycleBin([string]$Path) {',
    '  try {',
    '    $root = [System.IO.Path]::GetPathRoot($Path)',
    "    if (-not $root -or $root.StartsWith('\\')) { return $false }",
    '    return ([System.IO.DriveInfo]::new($root)).DriveType -eq [System.IO.DriveType]::Fixed',
    '  } catch { return $false }',
    '}',
    '',
    '# -Folder only marks the line for the reader: files and folders are recycled the same way.',
    'function Remove-ToRecycleBin([string]$Path, [switch]$Folder) {',
    '  if (-not (Test-RecycleBin $Path)) {',
    `    Write-Host (${msg('skipped')} -f $Path, ${msg('noBin')}); $script:skipped++; return`,
    '  }',
    '  if (-not (Test-Path -LiteralPath $Path)) {',
    `    Write-Host (${msg('gone')} -f $Path); $script:gone++; return`,
    '  }',
    `  if ($DryRun) { Write-Host (${msg('would')} -f $Path); return }`,
    '  $result = [NextLevelRecycler]::Recycle($Path)',
    '  if ($result -eq 0) {',
    `    Write-Host (${msg('recycled')} -f $Path); $script:recycled++`,
    '  } elseif ($result -eq -1) {',
    `    Write-Host (${msg('skipped')} -f $Path, ${msg('notRecycled')}); $script:skipped++`,
    '  } else {',
    `    Write-Host (${msg('skipped')} -f $Path, ('0x{0:X}' -f $result)); $script:skipped++`,
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
