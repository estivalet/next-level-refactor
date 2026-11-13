<#
.SYNOPSIS
  Packaging smoke test (D50, D51; M10 Review Focus 1 and 2).

.DESCRIPTION
  Installs the NSIS installer silently into a temporary folder, puts marker files in data\ and
  Catalog\, starts NextLevel once (the updater runs), installs again over it (an upgrade) and
  uninstalls. Passes when the markers are unchanged after the upgrade and the uninstall,
  NextLevel.exe is gone after the uninstall, and nothing appeared in %LOCALAPPDATA% for the
  updater. Exit code 1 on any failure.

  It adds and removes a real per-user install (Start-menu and desktop shortcuts, the Apps &
  features entry) on the PC it runs on; use a CI runner or a PC without NextLevel installed.

.EXAMPLE
  pwsh apps/launcher/scripts/packaging-smoke.ps1 -Installer "apps/launcher/dist/NextLevel Setup 0.10.0.exe"
#>
param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [int]$RunSeconds = 15
)

$ErrorActionPreference = 'Stop'
$failures = New-Object System.Collections.Generic.List[string]
function Fail([string]$message) { $failures.Add($message); Write-Host "FAIL: $message" }
function Pass([string]$message) { Write-Host "ok:   $message" }

$installer = (Resolve-Path $Installer).Path
$root = Join-Path ([System.IO.Path]::GetTempPath()) ("nl-smoke-" + [guid]::NewGuid().ToString('N'))
$target = Join-Path $root 'NL'
$exe = Join-Path $target 'NextLevel.exe'
$uninstaller = Join-Path $target 'Uninstall NextLevel.exe'
$updaterDirs = @('nextlevel-updater', '@nextlevellauncher-updater', 'NextLevel-updater') |
  ForEach-Object { Join-Path $env:LOCALAPPDATA $_ }

function Install() {
  $p = Start-Process -FilePath $installer -ArgumentList '/S', "/D=$target" -PassThru -Wait
  if ($p.ExitCode -ne 0) { Fail "installer exited with $($p.ExitCode)" }
}

function WaitUntil([scriptblock]$condition, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (& $condition) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Markers() {
  @(
    (Get-FileHash (Join-Path $target 'data\marker.txt')).Hash,
    (Get-FileHash (Join-Path $target 'Catalog\x\marker.bin')).Hash
  ) -join ','
}

function StopInstalled() {
  Get-CimInstance Win32_Process -Filter "Name='NextLevel.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($target, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

try {
  $before = $updaterDirs | Where-Object { Test-Path $_ }
  if ($before) { Write-Host "note: already present before the test: $($before -join ', ')" }

  # 1. Fresh install.
  Install
  if (Test-Path $exe) { Pass 'installed' } else { Fail "NextLevel.exe missing after install in $target" }
  if (Test-Path $uninstaller) { Pass 'uninstaller beside the exe (installKind nsis)' } else { Fail 'uninstaller missing' }
  # The installer's copy of itself (differential updates) goes to data\updates, not %LOCALAPPDATA%.
  $copies = @(Get-ChildItem -Path (Join-Path $target 'data\updates') -Recurse -Filter 'installer.exe' -ErrorAction SilentlyContinue)
  if ($copies.Count -eq 1) { Pass "installer copy in $($copies[0].DirectoryName)" } else { Fail 'no installer copy under data\updates' }

  # 2. A used folder: data and catalog files.
  New-Item -ItemType Directory -Force (Join-Path $target 'data') | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $target 'Catalog\x') | Out-Null
  Set-Content -Path (Join-Path $target 'data\marker.txt') -Value "kept $(Get-Date -Format o)" -Encoding utf8
  [System.IO.File]::WriteAllBytes((Join-Path $target 'Catalog\x\marker.bin'), [byte[]](1..255))
  $hashes = Markers

  # 3. Start NextLevel once so the updater runs (no ELECTRON_RUN_AS_NODE from the caller).
  $saved = $env:ELECTRON_RUN_AS_NODE
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  try {
    Start-Process -FilePath $exe | Out-Null
    Start-Sleep -Seconds $RunSeconds
  } finally {
    StopInstalled
    if ($null -ne $saved) { $env:ELECTRON_RUN_AS_NODE = $saved }
  }
  if (Test-Path (Join-Path $target 'data\settings.json')) { Pass 'the app wrote its data next to the exe' } else { Fail 'no data\settings.json after starting the app' }

  # 4. Upgrade: the installer again over the used folder.
  Install
  if ((Markers) -eq $hashes) { Pass 'data\ and Catalog\ unchanged after the upgrade' } else { Fail 'markers changed after the upgrade' }
  if (Test-Path $exe) { Pass 'NextLevel.exe present after the upgrade' } else { Fail 'NextLevel.exe missing after the upgrade' }

  # Another program's files in the same folder (e.g. NextLevel installed into an emulator folder):
  # the uninstaller removes only NextLevel's own files.
  $decoys = @('other-core.dll', 'game.bin', 'mame.dat', 'config.json', 'LICENSE-other.txt')
  foreach ($name in $decoys) { Set-Content -Path (Join-Path $target $name) -Value 'not NextLevel' -Encoding ascii }

  # 5. Uninstall. The NSIS uninstaller copies itself away and returns at once: wait for the exe.
  Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait | Out-Null
  if (WaitUntil { -not (Test-Path $exe) } 60) { Pass 'NextLevel.exe removed by the uninstaller' } else { Fail 'NextLevel.exe still there after uninstall' }
  Start-Sleep -Seconds 2
  if ((Test-Path (Join-Path $target 'data\marker.txt')) -and (Test-Path (Join-Path $target 'Catalog\x\marker.bin')) -and ((Markers) -eq $hashes)) {
    Pass 'data\ and Catalog\ kept, byte for byte, after the uninstall'
  } else {
    Fail 'markers missing or changed after the uninstall'
  }
  $left = @(Get-ChildItem -Force $target | ForEach-Object { $_.Name } | Sort-Object)
  $expected = @(@('data', 'Catalog') + $decoys | Sort-Object)
  if (($left -join '|') -eq ($expected -join '|')) {
    Pass 'only data\, Catalog\ and the other program''s files are left'
  } else {
    Fail "after uninstall the folder holds: $($left -join ', ') (expected $($expected -join ', '))"
  }

  # 6. D50: the updater wrote nothing to %LOCALAPPDATA%.
  $after = $updaterDirs | Where-Object { (Test-Path $_) -and ($before -notcontains $_) }
  if ($after) { Fail "updater folder outside the NextLevel folder: $($after -join ', ')" } else { Pass 'nothing in %LOCALAPPDATA% for the updater' }
} catch {
  Fail "unexpected error: $_"
} finally {
  StopInstalled
  if (Test-Path $uninstaller) { Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait | Out-Null }
  Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

if ($failures.Count -gt 0) {
  Write-Host "packaging smoke: $($failures.Count) failure(s)"
  exit 1
}
Write-Host 'packaging smoke: passed'
exit 0
