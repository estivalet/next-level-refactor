# Launch comparison: NextLevelOS → rebuild

Generated 2026-11-01 by `npm run compare-launch -w apps/launcher`. Don’t edit it by hand: rerun the script after changing emulators, profiles or the importer.

- **NextLevelOS** (read only): `C:\lestivalet\NextLevelOS` — `launchers.json`, the system gamelists and `nextlevel-launcher.py`.
- **Rebuild** (read only): `C:/lestivalet/next-level-claude/.nextlevel-dev` — `settings.json` and `library.db`.

## How it compares

- Each system’s games are grouped by their launch fields (`core`, `config`, `alt_core`, `alt_game_config`, `shader`, `emulator`, `artfolder`, `launch_args`, `mame_media`, `squashfs_exe`). The first game of each group is the sample, so per-game settings are compared too.
- **NextLevelOS:** the command `electron/main.cjs` builds, then `nextlevel-launcher.py`’s own `main()` with every process caught instead of run. Squashfs images are not mounted: the mount’s path shows as `<squashfs mount>`.
- **Rebuild:** the game’s launch override from the library, then the same `resolveProfile` → `locateRom` → `buildCommand` steps as `LaunchService`. Archives are not extracted.
- Paths are compared without case and with either slash. Nothing is started.

## Summary

| Outcome | Meaning | Variants | Games |
| :--- | :--- | ---: | ---: |
| match | Same program, arguments, working folder and environment | 7 | 2711 |
| cwdOrEnv | Same program and arguments; working folder or environment differs | 0 | 0 |
| order | Same program and arguments, in another order | 0 | 0 |
| missingConfig | Same, except NextLevelOS also appends a config file that isn’t there (RetroArch skips it) | 0 | 0 |
| args | Same program, different arguments | 980 | 75589 |
| emulator | A different program | 19 | 2950 |
| newError | Only the rebuild can’t build a command | 169 | 16129 |
| oldError | Only NextLevelOS can’t build a command | 2 | 34 |
| bothError | Neither can build a command | 27 | 1023 |

4 systems in `launchers.json` have no gamelist: `Benesse Pocket Challenge W`, `Konami Handheld`, `Sega ST-V`, `Sega Triforce_old`.

## Start these by hand

The comparison checks the commands; it can’t show an emulator starts. Start one game per program the rebuild runs, once:

| Program | Systems | Try this game | System | Same command as NextLevelOS |
| :--- | ---: | :--- | :--- | :--- |
| `E:\NextLevel\emulators\retroarch\retroarch.exe` | 120 | `! Brazil/2-in-1 - Freeway and Tennis (Brazil) (PAL-M) [p1].zip` | Atari 2600 | yes |
| `e:\NextLevel\emulators\mame\mame.exe` | 180 | `Galaxy Wars & Hangman (19xx)(-)[translated].zip` | Aamber Pegasus | no (args) |
| `e:\NextLevel\emulators\dolphin-master-5.0-13178-x64\Dolphin.exe` | 3 | `SRS - Street Racing Syndicate (USA).rvz` | Nintendo GameCube | no (args) |
| `e:\NextLevel\emulators\pcsx2-v2.6.1-windows-x64-Qt\pcsx2-qt.exe` | 1 | `Fight Night 2004 (USA).gz` | Sony Playstation 2 | yes |
| `e:\NextLevel\emulators\cemu\Cemu.exe` | 1 | `007 Legends (USA).wua` | Nintendo Wii U | no (args) |
| `e:\NextLevel\emulators\azahar\azahar.exe` | 1 | `! Translated/Dragon Quest Monsters - Terry no Wonderland 3D (Japan) (Translated En).zip` | Nintendo 3DS | yes |
| `e:\NextLevel\emulators\xemu-chihiro-PLAYTEST-1\xemu.exe` | 1 | `Voodoo Vince (Europe) (En,Fr,De,Es).iso` | Microsoft XBOX | no (emulator) |
| `e:\NextLevel\emulators\ryubing\Ryujinx.exe` | 1 | `1917 - The Alien Invasion DX.nsp` | Nintendo Switch | no (emulator) |
| `e:\NextLevel\emulators\scummvm-2026.2.0-win32-x86_64\scummvm.exe` | 1 | `Maniac Mansion Deluxe.bat` | Adventure Game Studio | no (emulator) |

Then go through **Differences** below.

## Most common argument differences

For the **args** outcome: arguments only one launcher passes, lowercased, with the game’s paths shown as `{rom}`, `{systemDir}` and `{emulatorDir}`. Top 40 by games.

| Only in | Argument | Systems | Variants | Games | Missing on disk |
| :--- | :--- | ---: | ---: | ---: | ---: |
| NextLevelOS | `-c` | 119 | 414 | 62293 |  |
| NextLevelOS | `{emulatorDir}\config\{system}\{romName}.cfg` | 118 | 402 | 60044 | 376 of 402 |
| NextLevelOS | `--appendconfig` | 117 | 393 | 54592 |  |
| NextLevelOS | `{emulatorDir}\config\{system}.cfg` | 116 | 392 | 52429 | 1 of 392 |
| NextLevelOS | `-artpath` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\artwork` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-cfg_directory` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\cfg` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-snapshot_directory` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\snap` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-nvram_directory` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\nvram` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-diff_directory` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\diff` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-hashpath` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\hash` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-languagepath` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}\language` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-inipath` | 169 | 562 | 10409 |  |
| NextLevelOS | `{emulatorDir}` | 169 | 562 | 10409 | 0 of 562 |
| NextLevelOS | `-uimodekey` | 169 | 562 | 10409 |  |
| NextLevelOS | `del` | 169 | 562 | 10409 |  |
| rebuild | `{rom}` | 8 | 273 | 3806 |  |
| NextLevelOS | `--exec={rom}` | 3 | 3 | 2279 |  |
| rebuild | `-b` | 3 | 3 | 2279 |  |
| rebuild | `-e` | 3 | 3 | 2279 |  |
| NextLevelOS | `-autoboot_delay` | 14 | 30 | 2205 |  |
| NextLevelOS | `-autoboot_command` | 14 | 30 | 2205 |  |
| NextLevelOS | `{emulatorDir}\config\nintendo nes.cfg` | 1 | 1 | 2163 | 0 of 1 |
| NextLevelOS | `{emulatorDir}\config\nintendo nes\{romName}.cfg` | 1 | 1 | 2163 | 0 of 1 |
| NextLevelOS | `%commands%` | 10 | 12 | 1956 |  |
| NextLevelOS | `-rompath` | 2 | 3 | 1077 |  |
| NextLevelOS | `{systemDir}` | 2 | 3 | 1077 | 1 of 3 |
| NextLevelOS | `3` | 1 | 2 | 1076 |  |
| NextLevelOS | `-%media%` | 4 | 5 | 803 |  |
| NextLevelOS | `<squashfs mount>` | 1 | 1 | 635 |  |
| NextLevelOS | `--set-shader` | 1 | 1 | 635 |  |
| NextLevelOS | `{emulatorDir}\shaders\shaders_slang\hqx\hq4x.slangp` | 1 | 1 | 635 | 0 of 1 |
| NextLevelOS | `-g={rom}` | 1 | 1 | 608 |  |
| rebuild | `-g` | 1 | 1 | 608 |  |

## Systems

Systems with a difference first.

| System | Rebuild id | Games | Variants | Result | NextLevelOS program | Rebuild profile |
| :--- | :--- | ---: | ---: | :--- | :--- | :--- |
| AAE | `aae` | 35 | 1 | 1 newError | run.bat | NO_PROFILE |
| Aamber Pegasus | `aamber-pegasus` | 3 | 1 | 1 args | mame.exe | MAME – Aamber Pegasus |
| Acetronic MPU-1000 | `acetronic-mpu-1000` | 38 | 1 | 1 args | mame.exe | MAME – Acetronic MPU-1000 |
| Acorn Archimedes | `acorn-archimedes` | 140 | 1 | 1 args | mame.exe | MAME – Acorn Archimedes |
| Acorn Atom | `acorn-atom` | 113 | 2 | 2 args | mame.exe | MAME – Acorn Atom |
| Acorn BBC Micro | `acorn-bbc-micro` | 1077 | 3 | 2 args, 1 emulator | mame.exe, retroarch.exe | MAME – Acorn BBC Micro |
| Acorn Electron | `acorn-electron` | 154 | 1 | 1 args | mame.exe | MAME – Acorn Electron |
| Adrenaline PC | `adrenaline-pc` | 9 | 1 | 1 bothError | — | NO_PROFILE |
| Adventure Game Studio | `adventure-game-studio` | 1 | 1 | 1 emulator | Maniac Mansion Deluxe.bat | ScummVM |
| American Laser Games | `american-laser-games` | 7 | 1 | 1 newError | emulator.cmd | NO_PROFILE |
| Amstrad CPC | `amstrad-cpc` | 3238 | 1 | 1 args | retroarch.exe | RetroArch – cap32 |
| Amstrad CPC Plus | `amstrad-cpc-plus` | 11 | 2 | 2 args | mame.exe | MAME – Amstrad CPC Plus |
| Amstrad GX4000 | `amstrad-gx4000` | 56 | 2 | 1 args, 1 emulator | retroarch.exe, mame.exe | RetroArch – cap32 |
| Amstrad PCW | `amstrad-pcw` | 129 | 1 | 1 args | mame.exe | MAME – Amstrad PCW |
| APF Imagination Machine | `apf-imagination-machine` | 116 | 1 | 1 args | mame.exe | MAME – APF Imagination Machine |
| APF MP-1000 | `apf-mp-1000` | 11 | 1 | 1 args | mame.exe | MAME – APF MP-1000 |
| Apogee BK-01 | `apogee-bk-01` | 92 | 1 | 1 args | mame.exe | MAME – Apogee BK-01 |
| Apple II | `apple-ii` | 1106 | 1 | 1 args | mame.exe | MAME – Apple II |
| Apple IIGS | `apple-iigs` | 334 | 1 | 1 args | mame.exe | MAME – Apple IIGS |
| Apple III | `apple-iii` | 22 | 1 | 1 args | mame.exe | MAME – Apple III |
| Apple Macintosh | `apple-macintosh` | 108 | 1 | 1 args | mame.exe | MAME – Apple Macintosh |
| Applied Technology MicroBee | `applied-technology-microbee` | 198 | 1 | 1 args | mame.exe | MAME – Applied Technology MicroBee |
| Apricot PC | `apricot-pc` | 45 | 1 | 1 args | mame.exe | MAME – Apricot PC |
| Arcade | `arcade` | 2899 | 19 | 18 args, 1 emulator | retroarch.exe, mame.exe | RetroArch – fbneo |
| Arcade Gun Games | `arcade-gun-games` | 92 | 2 | 2 bothError | — | NO_PROFILE |
| Arcade PC | `arcade-pc` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Arduboy | `arduboy` | 256 | 1 | 1 args | retroarch.exe | RetroArch – arduous |
| Atari 5200 | `atari-5200` | 97 | 1 | 1 args | retroarch.exe | RetroArch – atari800 |
| Atari 7800 | `atari-7800` | 69 | 1 | 1 args | retroarch.exe | RetroArch – prosystem |
| Atari 800 | `atari-800` | 586 | 1 | 1 args | retroarch.exe | RetroArch – atari800 |
| Atari Jaguar | `atari-jaguar` | 239 | 1 | 1 args | retroarch.exe | RetroArch – virtualjaguar |
| Atari Jaguar CD | `atari-jaguar-cd` | 25 | 2 | 2 newError | Ants (USA) (Unl).bat, baldies.bat | NO_PROFILE |
| Atari Lynx | `atari-lynx` | 120 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_lynx |
| Atari ST | `atari-st` | 2102 | 1 | 1 args | retroarch.exe | RetroArch – hatarib |
| Atari XEGS | `atari-xegs` | 32 | 1 | 1 args | retroarch.exe | RetroArch – atari800 |
| Bally Astrocade | `bally-astrocade` | 48 | 1 | 1 args | mame.exe | MAME – Bally Astrocade |
| Bandai Datach | `bandai-datach` | 7 | 1 | 1 args | retroarch.exe | RetroArch – fceumm |
| Bandai Gundam RX-78 | `bandai-gundam-rx-78` | 15 | 1 | 1 args | mame.exe | MAME – Bandai Gundam RX-78 |
| Bandai Let's TV Play Classic | `bandai-let-s-tv-play-classic` | 6 | 6 | 6 args | mame.exe | MAME – Bandai Let's TV Play Classic |
| Bandai Sufami Turbo | `bandai-sufami-turbo` | 13 | 1 | 1 args | retroarch.exe | RetroArch – snes9x |
| Bandai Super Note Club | `bandai-super-note-club` | 11 | 1 | 1 args | mame.exe | MAME – Bandai Super Note Club |
| Bandai Super Vision 8000 | `bandai-super-vision-8000` | 7 | 1 | 1 args | mame.exe | MAME – Bandai Super Vision 8000 |
| Bandai Tamagochi | `bandai-tamagochi` | 1 | 1 | 1 args | mame.exe | MAME – Bandai Tamagochi |
| Bandai Wonderswan | `bandai-wonderswan` | 119 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_wswan |
| Bandai Wonderswan Color | `bandai-wonderswan-color` | 96 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_wswan |
| Benesse Pocket Challenge V2 | `benesse-pocket-challenge-v2` | 13 | 1 | 1 args | mame.exe | MAME – Benesse Pocket Challenge V2 |
| Big Fish Games | `big-fish-games` | 155 | 1 | 1 newError |  | NO_PROFILE |
| Bit Corporation BIT 90 | `bit-corporation-bit-90` | 2 | 1 | 1 args | mame.exe | MAME – Bit Corporation BIT 90 |
| Brainchild PLS-1000 | `brainchild-pls-1000` | 5 | 1 | 1 emulator | retroarch.exe | MAME – Brainchild PLS-1000 |
| Cambridge Z88 | `cambridge-z88` | 2 | 1 | 1 args | mame.exe | MAME – Cambridge Z88 |
| Camputers Lynx | `camputers-lynx` | 32 | 2 | 2 args | mame.exe | MAME – Camputers Lynx |
| Canon X-07 | `canon-x-07` | 4 | 2 | 2 args | mame.exe | MAME – Canon X-07 |
| Capcom System 256 | `capcom-system-256` | 1 | 1 | 1 bothError | — | NO_PROFILE |
| Casio Loopy | `casio-loopy` | 10 | 1 | 1 args | mame.exe | MAME – Casio Loopy |
| Casio PV-1000 | `casio-pv-1000` | 13 | 1 | 1 args | mame.exe | MAME – Casio PV-1000 |
| Casio PV-2000 | `casio-pv-2000` | 11 | 1 | 1 args | mame.exe | MAME – Casio PV-2000 |
| Cave 3rd | `cave-3rd` | 25 | 1 | 1 newError | demul.exe | NO_PROFILE |
| Cave PC | `cave-pc` | 3 | 1 | 1 bothError | — | NO_PROFILE |
| CCE MC-1000 | `cce-mc-1000` | 29 | 2 | 2 args | mame.exe | MAME – CCE MC-1000 |
| ChaiLove | `chailove` | 5 | 1 | 1 args | retroarch.exe | RetroArch – chailove |
| China Education Computer | `china-education-computer` | 22 | 1 | 1 args | mame.exe | MAME – China Education Computer |
| Chip8 | `chip8` | 110 | 1 | 1 args | retroarch.exe | RetroArch – jaxe |
| Coastal PC | `coastal-pc` | 3 | 1 | 1 bothError | — | NO_PROFILE |
| Coleco Adam | `coleco-adam` | 67 | 1 | 1 emulator | retroarch.exe | MAME – Coleco Adam |
| Coleco ColecoVision | `coleco-colecovision` | 240 | 2 | 1 args, 1 emulator | retroarch.exe, ColEm.exe | RetroArch – bluemsx |
| Coleco Telstar | `coleco-telstar` | 1 | 1 | 1 newError | tennis.bat | NO_PROFILE |
| Commander X16 | `commander-x16` | 17 | 1 | 1 newError | Chase Vault.bat | NO_PROFILE |
| Commodore 128 | `commodore-128` | 63 | 1 | 1 bothError | — | NO_PROFILE |
| Commodore 16 | `commodore-16` | 334 | 1 | 1 args | retroarch.exe | RetroArch – vice_xplus4 |
| Commodore 64 | `commodore-64` | 4237 | 1 | 1 args | retroarch.exe | RetroArch – vice_x64 |
| Commodore Amiga | `commodore-amiga` | 2891 | 1 | 1 args | retroarch.exe | RetroArch – puae |
| Commodore Amiga 1200 | `commodore-amiga-1200` | 190 | 1 | 1 args | retroarch.exe | RetroArch – puae |
| Commodore Amiga CD32 | `commodore-amiga-cd32` | 515 | 2 | 2 args | retroarch.exe | RetroArch – puae |
| Commodore CDTV | `commodore-cdtv` | 65 | 1 | 1 args | retroarch.exe | RetroArch – puae |
| Commodore Max Machine | `commodore-max-machine` | 16 | 1 | 1 bothError | — | NO_PROFILE |
| Commodore PET | `commodore-pet` | 275 | 1 | 1 args | retroarch.exe | RetroArch – vice_xpet |
| Commodore Plus4 | `commodore-plus4` | 375 | 2 | 1 args, 1 emulator | retroarch.exe, YapeSDL.exe | RetroArch – vice_xplus4 |
| Commodore VIC-20 | `commodore-vic-20` | 1356 | 1 | 1 args | retroarch.exe | RetroArch – vice_xvic |
| Compucolor II | `compucolor-ii` | 221 | 1 | 1 args | mame.exe | MAME – Compucolor II |
| CoolBoy | `coolboy` | 6 | 6 | 6 newError | mame.exe | NO_PROFILE |
| Creatronic Mega Duck | `creatronic-mega-duck` | 23 | 1 | 1 emulator | retroarch.exe | MAME – Creatronic Mega Duck |
| Daphne | `daphne` | 19 | 1 | 1 newError | hypseus.exe | NO_PROFILE |
| DEC PDP-1 | `dec-pdp-1` | 3 | 1 | 1 args | mame.exe | MAME – DEC PDP-1 |
| DICE | `dice` | 23 | 1 | 1 newError | retroarch.exe | NO_PROFILE |
| Dick Smith Super-80 | `dick-smith-super-80` | 136 | 1 | 1 args | mame.exe | MAME – Dick Smith Super-80 |
| Dick Smith VZ-200 | `dick-smith-vz-200` | 170 | 1 | 1 args | mame.exe | MAME – Dick Smith VZ-200 |
| Digital ez LG | `digital-ez-lg` | 1 | 1 | 1 args | mame.exe | MAME – Digital ez LG |
| Doujin Soft Beatemups | `doujin-soft-beatemups` | 2 | 1 | 1 bothError | — | NO_PROFILE |
| Doujin Soft Shmups | `doujin-soft-shmups` | 21 | 1 | 1 bothError | — | NO_PROFILE |
| Dragon Data Dragon | `dragon-data-dragon` | 548 | 1 | 1 args | mame.exe | MAME – Dragon Data Dragon |
| Dream 6800 | `dream-6800` | 72 | 1 | 1 args | mame.exe | MAME – Dream 6800 |
| dreamGEAR My Arcade | `dreamgear-my-arcade` | 11 | 11 | 11 args | mame.exe | MAME – dreamGEAR My Arcade |
| dreamGEAR Plug and Play | `dreamgear-plug-and-play` | 7 | 7 | 7 args | mame.exe | MAME – dreamGEAR Plug and Play |
| EACA EG2000 Colour Genie | `eaca-eg2000-colour-genie` | 123 | 1 | 1 args | mame.exe | MAME – EACA EG2000 Colour Genie |
| EasyRPG | `easyrpg` | 3 | 1 | 1 args | retroarch.exe | RetroArch – easyrpg |
| Elektronika BK | `elektronika-bk` | 47 | 1 | 1 args | mame.exe | MAME – Elektronika BK |
| Elektronska Industrija Pecom 64 | `elektronska-industrija-pecom-64` | 23 | 1 | 1 bothError | — | NO_PROFILE |
| Emerson Arcadia 2001 | `emerson-arcadia-2001` | 56 | 1 | 1 args | mame.exe | MAME – Emerson Arcadia 2001 |
| Enterprise 128 | `enterprise-128` | 2 | 1 | 1 bothError | — | NO_PROFILE |
| Enterprise 64 | `enterprise-64` | 90 | 1 | 1 args | mame.exe | MAME – Enterprise 64 |
| Entex Adventure Vision | `entex-adventure-vision` | 4 | 1 | 1 args | mame.exe | MAME – Entex Adventure Vision |
| Epoch Game Pocket Computer | `epoch-game-pocket-computer` | 7 | 1 | 1 args | mame.exe | MAME – Epoch Game Pocket Computer |
| Epoch SSD Company | `epoch-ssd-company` | 10 | 10 | 10 newError | mame.exe | NO_PROFILE |
| Epoch Super Cassette Vision | `epoch-super-cassette-vision` | 30 | 1 | 1 args | retroarch.exe | RetroArch – emuscv |
| Epoch TV Game Cassette Vision | `epoch-tv-game-cassette-vision` | 11 | 1 | 1 args | retroarch.exe | RetroArch – pd777 |
| ETI-660 Learners Microcomputer | `eti-660-learners-microcomputer` | 5 | 1 | 1 args | mame.exe | MAME – ETI-660 Learners Microcomputer |
| Examu eX-BOARD | `examu-ex-board` | 2 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Exelvision EXL 100 | `exelvision-exl-100` | 85 | 1 | 1 args | mame.exe | MAME – Exelvision EXL 100 |
| Exidy Sorcerer | `exidy-sorcerer` | 57 | 2 | 2 args | mame.exe | MAME – Exidy Sorcerer |
| Fairchild Channel F | `fairchild-channel-f` | 49 | 1 | 1 emulator | retroarch.exe | MAME – Fairchild Channel F |
| Final Burn Neo | `final-burn-neo` | 2227 | 1 | 1 args | retroarch.exe | RetroArch – fbneo |
| Fisher-Price I Can Play Guitar | `fisher-price-i-can-play-guitar` | 1 | 1 | 1 args | mame.exe | MAME – Fisher-Price I Can Play Guitar |
| Fisher-Price I Can Play Piano | `fisher-price-i-can-play-piano` | 13 | 1 | 1 args | mame.exe | MAME – Fisher-Price I Can Play Piano |
| Flash Games | `flash-games` | 351 | 1 | 1 bothError | — | NO_PROFILE |
| Fujitsu FM Towns | `fujitsu-fm-towns` | 38 | 1 | 1 args | mame.exe | MAME – Fujitsu FM Towns |
| Fujitsu FM Towns Marty | `fujitsu-fm-towns-marty` | 1 | 1 | 1 args | mame.exe | MAME – Fujitsu FM Towns Marty |
| Fujitsu FM-7 | `fujitsu-fm-7` | 110 | 2 | 2 args | mame.exe | MAME – Fujitsu FM-7 |
| Fujitsu FM77 AV | `fujitsu-fm77-av` | 10 | 1 | 1 args | mame.exe | MAME – Fujitsu FM77 AV |
| Funtech Super Acan | `funtech-super-acan` | 12 | 1 | 1 newError | retroarch.exe | NO_PROFILE |
| Future Pinball | `future-pinball` | 379 | 2 | 2 newError | Future Pinball.exe | NO_PROFILE |
| Gaelco 3D | `gaelco-3d` | 4 | 1 | 1 newError | demul.exe | NO_PROFILE |
| Gaelco PC | `gaelco-pc` | 4 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Gakken Compact Vision TV Boy | `gakken-compact-vision-tv-boy` | 6 | 1 | 1 args | mame.exe | MAME – Gakken Compact Vision TV Boy |
| Galaksija Plus | `galaksija-plus` | 48 | 1 | 1 args | mame.exe | MAME – Galaksija Plus |
| Gamate | `gamate` | 57 | 1 | 1 emulator | retroarch.exe | MAME – Gamate |
| Game & Watch | `game-watch` | 56 | 1 | 1 args | retroarch.exe | RetroArch – gw |
| GameHouse Games | `gamehouse-games` | 115 | 1 | 1 newError |  | NO_PROFILE |
| GameMaker Games | `gamemaker-games` | 14 | 1 | 1 newError | Archeo-Raid.lnk | NO_PROFILE |
| GamePark 32 | `gamepark-32` | 32 | 1 | 1 args | mame.exe | MAME – GamePark 32 |
| Gamewax PC | `gamewax-pc` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| GCE Vectrex | `gce-vectrex` | 98 | 1 | 1 args | retroarch.exe | RetroArch – vecx |
| Global VR | `global-vr` | 6 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Handy Vision | `handy-vision` | 2163 | 1 | 1 args | retroarch.exe | RetroArch – nestopia |
| Hartung Game Master | `hartung-game-master` | 11 | 1 | 1 args | mame.exe | MAME – Hartung Game Master |
| Hasbro TV Board Games | `hasbro-tv-board-games` | 5 | 5 | 5 args | mame.exe | MAME – Hasbro TV Board Games |
| HBMAME | `hbmame` | 8269 | 1 | 1 newError | hbmame.exe | NO_PROFILE |
| Hector HRX | `hector-hrx` | 62 | 1 | 1 args | mame.exe | MAME – Hector HRX |
| Hitachi Basic Master Level 3 | `hitachi-basic-master-level-3` | 17 | 1 | 1 newError | retroarch.bat | NO_PROFILE |
| IBM PC 5150 | `ibm-pc-5150` | 5 | 1 | 1 args | mame.exe | MAME – IBM PC 5150 |
| IBM PC Jr | `ibm-pc-jr` | 48 | 1 | 1 args | mame.exe | MAME – IBM PC Jr |
| ICE PC | `ice-pc` | 10 | 1 | 1 bothError | — | NO_PROFILE |
| Infocom Z-Machine | `infocom-z-machine` | 24 | 1 | 1 args | retroarch.exe | RetroArch – mojozork |
| Intec InterAct | `intec-interact` | 2 | 2 | 2 args | mame.exe | MAME – Intec InterAct |
| Interact Home Computer | `interact-home-computer` | 21 | 1 | 1 args | mame.exe | MAME – Interact Home Computer |
| Interton VC 4000 | `interton-vc-4000` | 37 | 1 | 1 args | mame.exe | MAME – Interton VC 4000 |
| iQue Player | `ique-player` | 16 | 1 | 1 args | retroarch.exe | RetroArch – mupen64plus_next |
| IT Nighthawk | `it-nighthawk` | 20 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Jakks Pacific Game Key | `jakks-pacific-game-key` | 14 | 6 | 6 args | mame.exe | MAME – Jakks Pacific Game Key |
| Jakks Pacific Inc | `jakks-pacific-inc` | 49 | 49 | 49 args | mame.exe | MAME – Jakks Pacific Inc |
| Jumping Popira | `jumping-popira` | 19 | 1 | 1 args | mame.exe | MAME – Jumping Popira |
| Jungle Sport Vii | `jungle-sport-vii` | 3 | 1 | 1 args | mame.exe | MAME – Jungle Sport Vii |
| JungleTac | `jungletac` | 13 | 13 | 13 newError | mame.exe | NO_PROFILE |
| Jupiter Ace | `jupiter-ace` | 108 | 1 | 1 args | mame.exe | MAME – Jupiter Ace |
| KOEI PasoGo | `koei-pasogo` | 6 | 1 | 1 args | mame.exe | MAME – KOEI PasoGo |
| Konami PC | `konami-pc` | 29 | 1 | 1 bothError | — | NO_PROFILE |
| Konami Viper | `konami-viper` | 2 | 1 | 1 bothError | — | NO_PROFILE |
| Laserdisc | `laserdisc` | 1 | 1 | 1 newError | emulator.cmd | NO_PROFILE |
| LCD Games | `lcd-games` | 121 | 121 | 121 args | mame.exe | MAME – LCD Games |
| LJN VideoArt | `ljn-videoart` | 9 | 1 | 1 args | mame.exe | MAME – LJN VideoArt |
| Locomalito Games | `locomalito-games` | 8 | 1 | 1 newError | 8bit Killer.lnk | NO_PROFILE |
| LowRes NX | `lowres-nx` | 54 | 1 | 1 args | retroarch.exe | RetroArch – lowresnx |
| Lucas Nascom 2 | `lucas-nascom-2` | 43 | 1 | 1 args | mame.exe | MAME – Lucas Nascom 2 |
| Lutro | `lutro` | 9 | 1 | 1 args | retroarch.exe | RetroArch – lutro |
| Luxor ABC 80 | `luxor-abc-80` | 121 | 1 | 1 newError | retroarch.bat | NO_PROFILE |
| Lviv PC-01 | `lviv-pc-01` | 104 | 1 | 1 args | mame.exe | MAME – Lviv PC-01 |
| Magnavox Odyssey 2 | `magnavox-odyssey-2` | 131 | 1 | 1 args | retroarch.exe | RetroArch – o2em |
| MAME | `mame` | 4794 | 1 | 1 args | retroarch.exe | RetroArch – mame |
| Matra and Hachette Alice | `matra-and-hachette-alice` | 6 | 2 | 2 args | mame.exe | MAME – Matra and Hachette Alice |
| Mattel Aquarius | `mattel-aquarius` | 39 | 1 | 1 args | mame.exe | MAME – Mattel Aquarius |
| Mattel Captain Power | `mattel-captain-power` | 5 | 1 | 1 newError | hypseus.exe | NO_PROFILE |
| Mattel HyperScan | `mattel-hyperscan` | 7 | 1 | 1 args | mame.exe | MAME – Mattel HyperScan |
| Mattel Intellivision | `mattel-intellivision` | 164 | 1 | 1 args | retroarch.exe | RetroArch – freeintv |
| Memotech MTX | `memotech-mtx` | 45 | 2 | 2 args | mame.exe | MAME – Memotech MTX |
| MGT Sam Coupe | `mgt-sam-coupe` | 31 | 1 | 1 args | mame.exe | MAME – MGT Sam Coupe |
| Microkey Primo | `microkey-primo` | 7 | 1 | 1 args | mame.exe | MAME – Microkey Primo |
| Microsoft DOS | `microsoft-dos` | 1007 | 1 | 1 args | retroarch.exe | RetroArch – dosbox_pure |
| Microsoft MSX | `microsoft-msx` | 1771 | 2 | 1 args, 1 emulator | openmsx.exe, retroarch.exe | RetroArch – bluemsx |
| Microsoft MSX Remakes | `microsoft-msx-remakes` | 1 | 1 | 1 newError | Goonies, The.bat | NO_PROFILE |
| Microsoft MSX Turbo R | `microsoft-msx-turbo-r` | 18 | 1 | 1 newError | openmsx.exe | NO_PROFILE |
| Microsoft MSX2 | `microsoft-msx2` | 325 | 1 | 1 newError | openmsx.exe | NO_PROFILE |
| Microsoft MSX2+ | `microsoft-msx2-plus` | 88 | 1 | 1 newError | openmsx.exe | NO_PROFILE |
| Microsoft Windows 3.x | `microsoft-windows-3-x` | 928 | 3 | 3 newError | dosbox.exe | NO_PROFILE |
| Microsoft XBLA | `microsoft-xbla` | 721 | 1 | 1 newError | xenia_canary.exe | NO_PROFILE |
| Microsoft XBOX | `microsoft-xbox` | 241 | 1 | 1 emulator | xemu.exe | xemu |
| Microsoft XBOX 360 | `microsoft-xbox-360` | 308 | 4 | 4 newError | xenia_canary.exe | NO_PROFILE |
| Midway PC | `midway-pc` | 3 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Millennium | `millennium` | 4 | 1 | 1 bothError | — | MAME – Millennium |
| Milton Bradley Microvision | `milton-bradley-microvision` | 15 | 1 | 1 args | mame.exe | MAME – Milton Bradley Microvision |
| Mindset Personal Computer | `mindset-personal-computer` | 3 | 1 | 1 args | mame.exe | MAME – Mindset Personal Computer |
| Monon Color | `monon-color` | 17 | 1 | 1 args | mame.exe | MAME – Monon Color |
| MUGEN | `mugen` | 68 | 1 | 1 newError | Super Crazy Jam Season 2.lnk | NO_PROFILE |
| Musical | `musical` | 13 | 13 | 13 newError | mame.exe | NO_PROFILE |
| Namco BNA | `namco-bna` | 6 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco ESX | `namco-esx` | 26 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco N2 | `namco-n2` | 4 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco System 147 | `namco-system-147` | 2 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco System 148 | `namco-system-148` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco System 246 | `namco-system-246` | 28 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco System 256 | `namco-system-256` | 19 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Namco System 2x6 | `namco-system-2x6` | 48 | 1 | 1 newError | pcsx2-qt.exe | NO_PROFILE |
| Namco System 369 | `namco-system-369` | 19 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| NEC PC Engine | `nec-pc-engine` | 303 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_pce_fast |
| NEC PC Engine-CD | `nec-pc-engine-cd` | 370 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_pce_fast |
| NEC PC-6001 | `nec-pc-6001` | 221 | 3 | 3 args | mame.exe | MAME – NEC PC-6001 |
| NEC PC-6001 MKII | `nec-pc-6001-mkii` | 102 | 1 | 1 args | mame.exe | MAME – NEC PC-6001 MKII |
| NEC PC-8001 | `nec-pc-8001` | 26 | 1 | 1 args | mame.exe | MAME – NEC PC-8001 |
| NEC PC-8801 | `nec-pc-8801` | 55 | 1 | 1 args | retroarch.exe | RetroArch – quasi88 |
| NEC PC-9801 | `nec-pc-9801` | 48 | 1 | 1 args | retroarch.exe | RetroArch – nekop2 |
| NEC PC-FX | `nec-pc-fx` | 68 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_pcfx |
| NEC SuperGrafx | `nec-supergrafx` | 7 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_supergrafx |
| NEC TurboGrafx-16 | `nec-turbografx-16` | 94 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_pce_fast |
| NEC TurboGrafx-CD | `nec-turbografx-cd` | 61 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_pce_fast |
| Nichibutsu My Vision | `nichibutsu-my-vision` | 4 | 1 | 1 newError | retroarch.bat | NO_PROFILE |
| Nintendo 64 | `nintendo-64` | 504 | 1 | 1 args | retroarch.exe | RetroArch – mupen64plus_next |
| Nintendo 64DD | `nintendo-64dd` | 18 | 1 | 1 args | retroarch.exe | RetroArch – mupen64plus_next |
| Nintendo DS | `nintendo-ds` | 1792 | 1 | 1 args | retroarch.exe | RetroArch – desmume |
| Nintendo Famicom | `nintendo-famicom` | 1087 | 1 | 1 args | retroarch.exe | RetroArch – nestopia |
| Nintendo Famicom Disk System | `nintendo-famicom-disk-system` | 277 | 1 | 1 args | retroarch.exe | RetroArch – nestopia |
| Nintendo Family Basic | `nintendo-family-basic` | 29 | 1 | 1 args | mame.exe | MAME – Nintendo Family Basic |
| Nintendo Game Boy | `nintendo-game-boy` | 869 | 1 | 1 args | retroarch.exe | RetroArch – gambatte |
| Nintendo Game Boy 2 Players | `nintendo-game-boy-2-players` | 197 | 1 | 1 args | retroarch.exe | RetroArch – tgbdual |
| Nintendo Game Boy Advance | `nintendo-game-boy-advance` | 626 | 1 | 1 args | retroarch.exe | RetroArch – vba_next |
| Nintendo Game Boy Advance 2 Players | `nintendo-game-boy-advance-2-players` | 1061 | 1 | 1 newError | retroarch.exe | NO_PROFILE |
| Nintendo Game Boy Color | `nintendo-game-boy-color` | 544 | 1 | 1 args | retroarch.exe | RetroArch – gambatte |
| Nintendo Game Boy Color 2 Players | `nintendo-game-boy-color-2-players` | 577 | 1 | 1 args | retroarch.exe | RetroArch – tgbdual |
| Nintendo GameCube | `nintendo-gamecube` | 705 | 1 | 1 args | Dolphin.exe | Dolphin |
| Nintendo NES | `nintendo-nes` | 2641 | 2 | 2 args | retroarch.exe | RetroArch – nestopia |
| Nintendo NES 3D | `nintendo-nes-3d` | 133 | 1 | 1 newError | 1943 - The Battle of Midway.cmd | NO_PROFILE |
| Nintendo NES HD | `nintendo-nes-hd` | 32 | 1 | 1 newError | 25th Anniversary Super Mario Bros. (Europe) (Promo, Virtual Console).bat | NO_PROFILE |
| Nintendo NES MSU-1 | `nintendo-nes-msu-1` | 106 | 12 | 12 args | retroarch.exe | RetroArch – snes9x |
| Nintendo Pokemon Mini | `nintendo-pokemon-mini` | 23 | 1 | 1 args | retroarch.exe | RetroArch – pokemini |
| Nintendo Satellaview BSX | `nintendo-satellaview-bsx` | 68 | 1 | 1 args | retroarch.exe | RetroArch – snes9x |
| Nintendo SNES | `nintendo-snes` | 2265 | 1 | 1 args | retroarch.exe | RetroArch – snes9x |
| Nintendo SNES MSU-1 | `nintendo-snes-msu-1` | 257 | 257 | 257 args | retroarch.exe | RetroArch – snes9x |
| Nintendo Super Famicom | `nintendo-super-famicom` | 2407 | 1 | 1 args | retroarch.exe | RetroArch – snes9x |
| Nintendo Switch | `nintendo-switch` | 206 | 1 | 1 emulator | yuzu.exe | Ryujinx |
| Nintendo Virtual Boy | `nintendo-virtual-boy` | 26 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_vb |
| Nintendo Wii | `nintendo-wii` | 861 | 1 | 1 args | Dolphin.exe | Dolphin |
| Nintendo Wii U | `nintendo-wii-u` | 608 | 1 | 1 args | Cemu.exe | Cemu |
| Nintendo WiiWare | `nintendo-wiiware` | 713 | 1 | 1 args | Dolphin.exe | Dolphin |
| Nokia N-GAGE | `nokia-n-gage` | 51 | 1 | 1 newError | Ashen.cmd | NO_PROFILE |
| North Star Horizon | `north-star-horizon` | 9 | 1 | 1 args | mame.exe | MAME – North Star Horizon |
| OpenBOR | `openbor` | 369 | 1 | 1 newError | OpenBOR.exe | NO_PROFILE |
| Orion 128 | `orion-128` | 87 | 1 | 1 args | mame.exe | MAME – Orion 128 |
| Othello Multivision | `othello-multivision` | 9 | 1 | 1 args | retroarch.exe | RetroArch – gearsystem |
| Other Handhelds | `other-handhelds` | 25 | 25 | 25 newError | mame.exe | NO_PROFILE |
| Palm OS | `palm-os` | 29 | 1 | 1 args | retroarch.exe | RetroArch – mu |
| Palson CX 3000 Tele Computer | `palson-cx-3000-tele-computer` | 4 | 1 | 1 args | mame.exe | MAME – Palson CX 3000 Tele Computer |
| Panasonic 3DO | `panasonic-3do` | 391 | 1 | 1 args | retroarch.exe | RetroArch – opera |
| Partner | `partner` | 74 | 1 | 1 args | mame.exe | MAME – Partner |
| PDP VG Pocket | `pdp-vg-pocket` | 6 | 6 | 6 args | mame.exe | MAME – PDP VG Pocket |
| PEL Varazdin ORAO | `pel-varazdin-orao` | 4 | 1 | 1 args | mame.exe | MAME – PEL Varazdin ORAO |
| Phantom Systems | `phantom-systems` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Philips CD-i | `philips-cd-i` | 131 | 1 | 1 emulator | retroarch.exe | MAME – Philips CD-i |
| Philips P2000T | `philips-p2000t` | 17 | 1 | 1 args | retroarch.exe | RetroArch – mame |
| Philips VG5000 | `philips-vg5000` | 50 | 1 | 1 args | mame.exe | MAME – Philips VG5000 |
| Philips Videopac Plus G7400 | `philips-videopac-plus-g7400` | 31 | 1 | 1 bothError | — | NO_PROFILE |
| PICO-8 Fantasy Console | `pico-8-fantasy-console` | 114 | 1 | 1 args | retroarch.exe | RetroArch – retro8 |
| Pinball FX | `pinball-fx` | 134 | 1 | 1 newError | pinballfx.exe | NO_PROFILE |
| Pinball FX2 | `pinball-fx2` | 89 | 1 | 1 newError | Alien_Isolation.bat | NO_PROFILE |
| Pinball FX3 | `pinball-fx3` | 100 | 1 | 1 newError | Alien_Isolation.bat | NO_PROFILE |
| Pinball M | `pinball-m` | 8 | 1 | 1 newError | pinballm.exe | NO_PROFILE |
| Pinball Wicked | `pinball-wicked` | 1 | 1 | 1 newError | PinballWicked.lnk | NO_PROFILE |
| PinballArcade | `pinballarcade` | 105 | 1 | 1 newError | ACDC.bat | NO_PROFILE |
| Pioneer LaserActive | `pioneer-laseractive` | 1 | 1 | 1 newError | Hyperion.bat | NO_PROFILE |
| Pokkito | `pokkito` | 1 | 1 | 1 newError | Jetpack.bat | NO_PROFILE |
| PopCap Games | `popcap-games` | 46 | 1 | 1 newError | Alchemy Deluxe.lnk | NO_PROFILE |
| Radica Arcade Legends | `radica-arcade-legends` | 15 | 15 | 15 args | mame.exe | MAME – Radica Arcade Legends |
| Radica Play TV | `radica-play-tv` | 23 | 23 | 23 args | mame.exe | MAME – Radica Play TV |
| Radio-86RK | `radio-86rk` | 21 | 1 | 1 args | mame.exe | MAME – Radio-86RK |
| Radio-86RK Mikrosha | `radio-86rk-mikrosha` | 66 | 1 | 1 args | mame.exe | MAME – Radio-86RK Mikrosha |
| Raw Thrills | `raw-thrills` | 33 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| RCA Studio II | `rca-studio-ii` | 7 | 1 | 1 args | mame.exe | MAME – RCA Studio II |
| Remakes | `remakes` | 18 | 1 | 1 newError | Abadia Del Crimen.lnk | NO_PROFILE |
| Retro Game Systems | `retro-game-systems` | 92 | 92 | 92 args | mame.exe | MAME – Retro Game Systems |
| RM Nimbus | `rm-nimbus` | 33 | 1 | 1 args | mame.exe | MAME – RM Nimbus |
| Rowtron Television Computer System | `rowtron-television-computer-system` | 2 | 1 | 1 args | mame.exe | MAME – Rowtron Television Computer System |
| Salter Fitness Pro Cardioline | `salter-fitness-pro-cardioline` | 3 | 3 | 3 args | mame.exe | MAME – Salter Fitness Pro Cardioline |
| Sammy Atomiswave | `sammy-atomiswave` | 30 | 1 | 1 args | retroarch.exe | RetroArch – flycast |
| Samsung Gamboy | `samsung-gamboy` | 34 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Samsung SPC-1000 | `samsung-spc-1000` | 19 | 1 | 1 args | mame.exe | MAME – Samsung SPC-1000 |
| Samsung SPC-1500 | `samsung-spc-1500` | 2 | 1 | 1 args | mame.exe | MAME – Samsung SPC-1500 |
| Sanyo MBC-55 | `sanyo-mbc-55` | 20 | 1 | 1 args | mame.exe | MAME – Sanyo MBC-55 |
| Sanyo PHC-25 | `sanyo-phc-25` | 13 | 1 | 1 args | mame.exe | MAME – Sanyo PHC-25 |
| ScummVM | `scummvm` | 635 | 1 | 1 args | retroarch.exe | RetroArch – scummvm |
| Sega 32X | `sega-32x` | 46 | 1 | 1 args | retroarch.exe | RetroArch – picodrive |
| Sega 32X CD | `sega-32x-cd` | 6 | 1 | 1 args | retroarch.exe | RetroArch – picodrive |
| Sega ALLs | `sega-alls` | 31 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Beena | `sega-beena` | 59 | 1 | 1 args | mame.exe | MAME – Sega Beena |
| Sega CD | `sega-cd` | 185 | 2 | 2 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Channel | `sega-channel` | 97 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Chihiro | `sega-chihiro` | 14 | 1 | 1 newError | Crazy Taxi High Roller.squashfs | NO_PROFILE |
| Sega Dreamcast | `sega-dreamcast` | 367 | 3 | 3 args | retroarch.exe | RetroArch – flycast |
| Sega Europa-R | `sega-europa-r` | 3 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Game Gear | `sega-game-gear` | 423 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Genesis | `sega-genesis` | 1388 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Hikaru | `sega-hikaru` | 1 | 1 | 1 newError | demul.exe | NO_PROFILE |
| Sega Lindbergh | `sega-lindbergh` | 43 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Mark III | `sega-mark-iii` | 132 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Master System | `sega-master-system` | 563 | 2 | 2 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Mega Drive | `sega-mega-drive` | 815 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Mega Drive MSU-1 | `sega-mega-drive-msu-1` | 63 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Mega-CD | `sega-mega-cd` | 61 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega Model 2 | `sega-model-2` | 42 | 1 | 1 newError | emulator.bat | NO_PROFILE |
| Sega Model 3 | `sega-model-3` | 25 | 1 | 1 newError | emulator.bat | NO_PROFILE |
| Sega Naomi | `sega-naomi` | 132 | 1 | 1 args | retroarch.exe | RetroArch – flycast |
| Sega Naomi 2 | `sega-naomi-2` | 12 | 1 | 1 args | retroarch.exe | RetroArch – flycast |
| Sega Naomi 2 GD-ROM | `sega-naomi-2-gd-rom` | 12 | 1 | 1 newError | demul.exe | NO_PROFILE |
| Sega Naomi GD-ROM | `sega-naomi-gd-rom` | 66 | 1 | 1 args | retroarch.exe | RetroArch – flycast |
| Sega Nu | `sega-nu` | 7 | 1 | 1 bothError | — | NO_PROFILE |
| Sega PC | `sega-pc` | 7 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Pico | `sega-pico` | 236 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega RingEdge | `sega-ringedge` | 12 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega RingEdge 2 | `sega-ringedge-2` | 14 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega RingWide | `sega-ringwide` | 15 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Saturn | `sega-saturn` | 378 | 4 | 4 args | retroarch.exe | RetroArch – kronos |
| Sega SC-3000 | `sega-sc-3000` | 44 | 2 | 1 args, 1 emulator | mame.exe, retroarch.exe | MAME – Sega SC-3000 |
| Sega SG-1000 | `sega-sg-1000` | 81 | 1 | 1 args | retroarch.exe | RetroArch – genesis_plus_gx |
| Sega SG-1000 II | `sega-sg-1000-ii` | 1 | 1 | 1 args | mame.exe | MAME – Sega SG-1000 II |
| Sega Triforce | `sega-triforce` | 8 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Sega Video Driver | `sega-video-driver` | 6 | 1 | 1 newError | hypseus.exe | NO_PROFILE |
| Sega VMU | `sega-vmu` | 46 | 1 | 1 args | mame.exe | MAME – Sega VMU |
| Senario | `senario` | 18 | 18 | 18 args | mame.exe | MAME – Senario |
| Senario Vs Maxx | `senario-vs-maxx` | 10 | 10 | 10 args | mame.exe | MAME – Senario Vs Maxx |
| Seta Aleck 64 | `seta-aleck-64` | 11 | 1 | 1 args | retroarch.exe | RetroArch – mupen64plus_next |
| Sharp MZ-2000 | `sharp-mz-2000` | 32 | 1 | 1 args | mame.exe | MAME – Sharp MZ-2000 |
| Sharp MZ-2200 | `sharp-mz-2200` | 41 | 1 | 1 args | mame.exe | MAME – Sharp MZ-2200 |
| Sharp MZ-2500 | `sharp-mz-2500` | 23 | 1 | 1 args | mame.exe | MAME – Sharp MZ-2500 |
| Sharp MZ-700 | `sharp-mz-700` | 37 | 1 | 1 args | mame.exe | MAME – Sharp MZ-700 |
| Sharp MZ-800 | `sharp-mz-800` | 13 | 1 | 1 args | mame.exe | MAME – Sharp MZ-800 |
| Sharp X1 | `sharp-x1` | 308 | 1 | 1 args | retroarch.exe | RetroArch – x1 |
| Sharp X68000 | `sharp-x68000` | 108 | 1 | 1 args | retroarch.exe | RetroArch – px68k |
| Sinclair ZX Spectrum | `sinclair-zx-spectrum` | 4713 | 1 | 1 args | retroarch.exe | RetroArch – fuse |
| Sinclair ZX81 | `sinclair-zx81` | 67 | 1 | 1 args | retroarch.exe | RetroArch – 81 |
| Singe | `singe` | 108 | 2 | 2 bothError | — | NO_PROFILE |
| SNK Hyper NeoGeo 64 | `snk-hyper-neogeo-64` | 7 | 1 | 1 args | retroarch.exe | RetroArch – mame |
| SNK Neo Geo | `snk-neo-geo` | 197 | 1 | 1 args | retroarch.exe | RetroArch – fbneo |
| SNK Neo Geo AES | `snk-neo-geo-aes` | 198 | 1 | 1 args | retroarch.exe | RetroArch – fbneo |
| SNK Neo Geo CD | `snk-neo-geo-cd` | 97 | 1 | 1 args | retroarch.exe | RetroArch – neocd |
| SNK Neo Geo MVS | `snk-neo-geo-mvs` | 164 | 1 | 1 args | retroarch.exe | RetroArch – fbneo |
| SNK Neo Geo Pocket | `snk-neo-geo-pocket` | 10 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_ngp |
| SNK Neo Geo Pocket Color | `snk-neo-geo-pocket-color` | 94 | 1 | 1 args | retroarch.exe | RetroArch – mednafen_ngp |
| Solarus RPG Game Engine | `solarus-rpg-game-engine` | 29 | 1 | 1 bothError | — | NO_PROFILE |
| Sony Playstation | `sony-playstation` | 1430 | 3 | 3 args | retroarch.exe | RetroArch – duckstation |
| Sony Playstation 3 | `sony-playstation-3` | 376 | 1 | 1 newError | TODO | NO_PROFILE |
| Sony Pocketstation | `sony-pocketstation` | 104 | 1 | 1 args | mame.exe | MAME – Sony Pocketstation |
| Sony PS Vita | `sony-ps-vita` | 164 | 1 | 1 bothError | — | NO_PROFILE |
| Sony PSP | `sony-psp` | 1127 | 1 | 1 args | retroarch.exe | RetroArch – ppsspp |
| Sony SMC-777 | `sony-smc-777` | 29 | 1 | 1 args | mame.exe | MAME – Sony SMC-777 |
| Sord M5 | `sord-m5` | 27 | 1 | 1 args | mame.exe | MAME – Sord M5 |
| Soundic Victory MPT-02 | `soundic-victory-mpt-02` | 1 | 1 | 1 args | mame.exe | MAME – Soundic Victory MPT-02 |
| Specialist | `specialist` | 161 | 1 | 1 newError | retroarch.bat | NO_PROFILE |
| Spectravideo | `spectravideo` | 115 | 1 | 1 args | retroarch.exe | RetroArch – bluemsx |
| Spectravideo SV-318 | `spectravideo-sv-318` | 24 | 1 | 1 args | mame.exe | MAME – Spectravideo SV-318 |
| SSEM | `ssem` | 12 | 1 | 1 args | mame.exe | MAME – SSEM |
| Super Control Station SF-7000 | `super-control-station-sf-7000` | 7 | 1 | 1 args | mame.exe | MAME – Super Control Station SF-7000 |
| Taito NESiCAxLive | `taito-nesicaxlive` | 49 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Taito NESiCAxLive 2 | `taito-nesicaxlive-2` | 5 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Taito Type X | `taito-type-x` | 17 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Taito Type X Zero | `taito-type-x-zero` | 1 | 1 | 1 bothError | — | NO_PROFILE |
| Taito Type X+ | `taito-type-x-plus` | 2 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Taito Type X2 | `taito-type-x2` | 27 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Taito Type X3 | `taito-type-x3` | 3 | 1 | 1 bothError | — | NO_PROFILE |
| Taito Type X4 | `taito-type-x4` | 8 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Takara DDR Family Mat | `takara-ddr-family-mat` | 6 | 1 | 1 args | mame.exe | MAME – Takara DDR Family Mat |
| Takara e-pitch | `takara-e-pitch` | 2 | 2 | 2 args | mame.exe | MAME – Takara e-pitch |
| Takara Popira | `takara-popira` | 19 | 1 | 1 args | mame.exe | MAME – Takara Popira |
| Takara Popira 2 | `takara-popira-2` | 19 | 1 | 1 args | mame.exe | MAME – Takara Popira 2 |
| Takara Taiko De Popira | `takara-taiko-de-popira` | 21 | 1 | 1 bothError | — | NO_PROFILE |
| Tandy Memorex VIS | `tandy-memorex-vis` | 1 | 1 | 1 args | mame.exe | MAME – Tandy Memorex VIS |
| Tandy TRS-80 | `tandy-trs-80` | 127 | 4 | 4 args | mame.exe | MAME – Tandy TRS-80 |
| Tandy TRS-80 Color Computer | `tandy-trs-80-color-computer` | 436 | 5 | 5 args | mame.exe | MAME – Tandy TRS-80 Color Computer |
| Tandy TRS-80 MC-10 | `tandy-trs-80-mc-10` | 148 | 1 | 1 args | mame.exe | MAME – Tandy TRS-80 MC-10 |
| Tangerine Microtan 65 | `tangerine-microtan-65` | 14 | 1 | 1 args | mame.exe | MAME – Tangerine Microtan 65 |
| Tangerine Oric | `tangerine-oric` | 130 | 1 | 1 args | mame.exe | MAME – Tangerine Oric |
| Tangerine Oric Atmos | `tangerine-oric-atmos` | 386 | 1 | 1 args | mame.exe | MAME – Tangerine Oric Atmos |
| Tatung Einstein TC-01 | `tatung-einstein-tc-01` | 38 | 1 | 1 args | mame.exe | MAME – Tatung Einstein TC-01 |
| Team Play PC | `team-play-pc` | 3 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Tesla Ondra | `tesla-ondra` | 10 | 1 | 1 args | mame.exe | MAME – Tesla Ondra |
| Tesla PMD-85 | `tesla-pmd-85` | 59 | 1 | 1 args | mame.exe | MAME – Tesla PMD-85 |
| Texas Instruments TI 99-4A | `texas-instruments-ti-99-4a` | 108 | 1 | 1 args | mame.exe | MAME – Texas Instruments TI 99-4A |
| Thomson MO5 | `thomson-mo5` | 252 | 1 | 1 emulator | retroarch.exe | MAME – Thomson MO5 |
| Thomson MO6 | `thomson-mo6` | 7 | 1 | 1 args | mame.exe | MAME – Thomson MO6 |
| Thomson TO7 | `thomson-to7` | 182 | 1 | 1 args | mame.exe | MAME – Thomson TO7 |
| Thomson TO8 | `thomson-to8` | 195 | 1 | 1 args | retroarch.exe | RetroArch – theodore |
| TIC-80 Tiny Computer | `tic-80-tiny-computer` | 263 | 1 | 1 args | retroarch.exe | RetroArch – tic80 |
| Tiger Game.com | `tiger-game-com` | 22 | 1 | 1 args | mame.exe | MAME – Tiger Game.com |
| Tiger Handheld Electronics | `tiger-handheld-electronics` | 39 | 1 | 1 args | mame.exe | MAME – Tiger Handheld Electronics |
| Tiger R-Zone | `tiger-r-zone` | 3 | 1 | 1 newError | mame.exe | MAME – Tiger R-Zone |
| TimeTop Gameking | `timetop-gameking` | 1 | 1 | 1 args | mame.exe | MAME – TimeTop Gameking |
| TimeTop GameKing 3 | `timetop-gameking-3` | 1 | 1 | 1 oldError | — | MAME – TimeTop GameKing 3 |
| Timex Sinclair 2068 | `timex-sinclair-2068` | 33 | 1 | 1 oldError | — | MAME – Timex Sinclair 2068 |
| Tomy Tutor | `tomy-tutor` | 29 | 1 | 1 args | mame.exe | MAME – Tomy Tutor |
| Toshiba Visicom | `toshiba-visicom` | 5 | 1 | 1 args | mame.exe | MAME – Toshiba Visicom |
| Touhou Project | `touhou-project` | 28 | 1 | 1 bothError | — | NO_PROFILE |
| Tronica | `tronica` | 7 | 7 | 7 args | mame.exe | MAME – Tronica |
| Ultimate Products Zone | `ultimate-products-zone` | 8 | 8 | 8 args | mame.exe | MAME – Ultimate Products Zone |
| Uniana PC | `uniana-pc` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Unique PC | `unique-pc` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Unis PC | `unis-pc` | 6 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| Unisonic Champion 2711 | `unisonic-champion-2711` | 4 | 1 | 1 args | mame.exe | MAME – Unisonic Champion 2711 |
| Uzebox | `uzebox` | 92 | 1 | 1 args | retroarch.exe | RetroArch – uzem |
| VaporSpec | `vaporspec` | 10 | 1 | 1 args | retroarch.exe | RetroArch – vaporspec |
| VEB Mikroelektronik | `veb-mikroelektronik` | 10 | 1 | 1 args | mame.exe | MAME – VEB Mikroelektronik |
| Vector-06C | `vector-06c` | 77 | 1 | 1 args | mame.exe | MAME – Vector-06C |
| Victory MPT-02 Home TV Programmer | `victory-mpt-02-home-tv-programmer` | 1 | 1 | 1 args | mame.exe | MAME – Victory MPT-02 Home TV Programmer |
| VideoBrain Family Computer | `videobrain-family-computer` | 17 | 1 | 1 args | mame.exe | MAME – VideoBrain Family Computer |
| VideoJet Pocket Dream Console | `videojet-pocket-dream-console` | 7 | 1 | 1 newError | mame.exe | MAME – VideoJet Pocket Dream Console |
| Videoton TV Computer | `videoton-tv-computer` | 2 | 2 | 2 args | mame.exe | MAME – Videoton TV Computer |
| Vircon32 | `vircon32` | 16 | 1 | 1 args | retroarch.exe | RetroArch – vircon32 |
| Visual Pinball | `visual-pinball` | 943 | 1 | 1 newError | VPinballX64.exe | NO_PROFILE |
| VM Labs Nuon | `vm-labs-nuon` | 6 | 1 | 1 newError | Ballistic.bat | NO_PROFILE |
| Voltmace Database | `voltmace-database` | 19 | 1 | 1 args | mame.exe | MAME – Voltmace Database |
| VTech Creativision | `vtech-creativision` | 17 | 1 | 1 emulator | retroarch.exe | MAME – VTech Creativision |
| VTech Laser 128 | `vtech-laser-128` | 25 | 1 | 1 args | mame.exe | MAME – VTech Laser 128 |
| VTech Laser 200 | `vtech-laser-200` | 133 | 1 | 1 args | mame.exe | MAME – VTech Laser 200 |
| VTech Laser 310 | `vtech-laser-310` | 117 | 1 | 1 args | mame.exe | MAME – VTech Laser 310 |
| VTech Laser 500 | `vtech-laser-500` | 5 | 1 | 1 args | mame.exe | MAME – VTech Laser 500 |
| VTech Socrates | `vtech-socrates` | 8 | 1 | 1 emulator | retroarch.exe | MAME – VTech Socrates |
| VTech V.Smile | `vtech-v-smile` | 68 | 1 | 1 args | mame.exe | MAME – VTech V.Smile |
| VTech V.Smile Baby | `vtech-v-smile-baby` | 1 | 1 | 1 args | mame.exe | MAME – VTech V.Smile Baby |
| VTech V.Smile Motion | `vtech-v-smile-motion` | 2 | 1 | 1 args | mame.exe | MAME – VTech V.Smile Motion |
| Wahlap PC | `wahlap-pc` | 1 | 1 | 1 newError | TeknoParrotUi.exe | NO_PROFILE |
| WASM-4 | `wasm-4` | 97 | 1 | 1 args | retroarch.exe | RetroArch – wasm4 |
| Watara Supervision | `watara-supervision` | 69 | 1 | 1 args | retroarch.exe | RetroArch – potator |
| WoW Action Max | `wow-action-max` | 5 | 1 | 1 newError | hypseus.exe | NO_PROFILE |
| Yamaha Copera | `yamaha-copera` | 9 | 1 | 1 args | mame.exe | MAME – Yamaha Copera |
| Z80 TV Game System | `z80-tv-game-system` | 1 | 1 | 1 args | mame.exe | MAME – Z80 TV Game System |
| Zaccaria Pinball | `zaccaria-pinball` | 122 | 1 | 1 newError | Aerobatics.bat | NO_PROFILE |
| Zemmix | `zemmix` | 80 | 1 | 1 args | retroarch.exe | RetroArch – fmsx |
| Zemmix Neo | `zemmix-neo` | 35 | 1 | 1 args | retroarch.exe | RetroArch – fmsx |
| Atari 2600 | `atari-2600` | 890 | 1 | 1 match | retroarch.exe | RetroArch – stella |
| Nintendo 3DS | `nintendo-3ds` | 500 | 2 | 2 match | azahar.exe | Azahar |
| Sony Playstation 2 | `sony-playstation-2` | 1321 | 4 | 4 match | pcsx2-qt.exe | PCSX2 |

## Differences

Each difference once, most games first, with the systems it affects and the variant with most games as the example. `only old` / `only new` list the arguments one side passes; `(missing)` marks an old path that isn’t on disk.

### 1. args — 113 systems, 116 variants, 51444 games

Systems: Amstrad CPC, Amstrad GX4000, Arduboy, Atari 5200, Atari 7800, Atari 800, Atari Jaguar, Atari Lynx, Atari ST, Atari XEGS, Bandai Datach, Bandai Sufami Turbo, Bandai Wonderswan, Bandai Wonderswan Color, ChaiLove, Chip8, Coleco ColecoVision, Commodore 16, Commodore 64, Commodore Amiga, Commodore Amiga 1200, Commodore Amiga CD32, Commodore CDTV, Commodore PET, Commodore Plus4 and 88 more.

Example: Sinclair ZX Spectrum · `007 - A View to a Kill (Europe).zip` (4713 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\fuse_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sinclair ZX Spectrum.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sinclair ZX Spectrum\007 - A View to a Kill (Europe).cfg" "e:\NextLevel\systems\Sinclair ZX Spectrum\007 - A View to a Kill (Europe).zip"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\fuse_libretro.dll "E:\NextLevel\systems\Sinclair ZX Spectrum\007 - A View to a Kill (Europe).zip"
     profile: RetroArch – fuse
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
```

### 2. newError — 1 system, 1 variant, 8269 games

Systems: HBMAME.

Example: HBMAME · `100doors.zip` (8269 games)

```text
old: e:/NextLevel/emulators/hbmame/hbmame.exe -artpath e:/NextLevel/emulators/hbmame/artwork -cfg_directory e:/NextLevel/emulators/hbmame/cfg -snapshot_directory e:/NextLevel/emulators/hbmame/snap -nvram_directory e:/NextLevel/emulators/hbmame/nvram -diff_directory e:/NextLevel/emulators/hbmame/diff -hashpath e:/NextLevel/emulators/hbmame/hash -languagepath e:/NextLevel/emulators/hbmame/language -inipath e:/NextLevel/emulators/hbmame/ -uimodekey DEL -skip_gameinfo -rompath e:\NextLevel\systems\HBMAME e:\NextLevel\systems\HBMAME\100doors.zip
     cwd: e:\NextLevel\emulators\hbmame
new: ERROR NO_PROFILE
```

### 3. args — 152 systems, 403 variants, 7911 games

Systems: Aamber Pegasus, Acetronic MPU-1000, Acorn Archimedes, Acorn Electron, Amstrad PCW, APF Imagination Machine, APF MP-1000, Apogee BK-01, Apple II, Apple IIGS, Apple III, Apple Macintosh, Applied Technology MicroBee, Apricot PC, Bally Astrocade, Bandai Gundam RX-78, Bandai Let's TV Play Classic, Bandai Super Note Club, Bandai Super Vision 8000, Bandai Tamagochi, Benesse Pocket Challenge V2, Bit Corporation BIT 90, Cambridge Z88, Casio Loopy, Casio PV-1000 and 127 more.

Example: Apple II · `3-D Docking Mission (USA).dsk` (1106 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe apple2ee -gameio joy -flop1 "e:\NextLevel\systems\Apple II\3-D Docking Mission (USA).dsk" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Apple II"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe apple2ee -gameio joy -flop1 "E:\NextLevel\systems\Apple II\3-D Docking Mission (USA).dsk" -rompath "E:\NextLevel\systems\Apple II" -skip_gameinfo
     profile: MAME – Apple II
     cwd: e:\NextLevel\emulators\mame
only old: -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 4. args — 3 systems, 9 variants, 7614 games

Systems: Arcade, MAME, Sega Master System.

Example: MAME · `88games.zip` (4794 games) — `core=mame_libretro`, `config=arcade-core-provided`, `shader=shaders_slang/hqx/hq4x.slangp`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\mame_libretro.dll -c e:/NextLevel/emulators/retroarch/config\arcade-core-provided.cfg --appendconfig e:/NextLevel/emulators/retroarch/config\MAME\88games.cfg e:\NextLevel\systems\MAME\88games.zip --set-shader e:/NextLevel/emulators/retroarch/shaders\shaders_slang/hqx/hq4x.slangp
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\mame_libretro.dll --appendconfig e:\NextLevel\emulators\retroarch\config\arcade-core-provided.cfg --set-shader e:\NextLevel\emulators\retroarch\shaders\shaders_slang\hqx\hq4x.slangp E:\NextLevel\systems\MAME\88games.zip
     profile: RetroArch – mame
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\{system}\{romName}.cfg
```

### 5. args — 3 systems, 3 variants, 2279 games

Systems: Nintendo GameCube, Nintendo Wii, Nintendo WiiWare.

Example: Nintendo Wii · `007 - Quantum of Solace (USA) (En,Fr).rvz` (861 games)

```text
old: e:/NextLevel/emulators/dolphin-master-5.0-13178-x64/Dolphin.exe "--exec=e:\roms\Nintendo Wii\007 - Quantum of Solace (USA) (En,Fr).rvz"
     cwd: e:\NextLevel\emulators\dolphin-master-5.0-13178-x64
new: e:\NextLevel\emulators\dolphin-master-5.0-13178-x64\Dolphin.exe -b -e "e:\roms\Nintendo Wii\007 - Quantum of Solace (USA) (En,Fr).rvz"
     profile: Dolphin
     cwd: e:\NextLevel\emulators\dolphin-master-5.0-13178-x64
only old: --exec={rom}
only new: -b -e {rom}
```

### 6. args — 1 system, 1 variant, 2163 games

Systems: Handy Vision.

Example: Handy Vision · `10-Yard Fight (USA, Europe).zip` (2163 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\nestopia_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES\10-Yard Fight (USA, Europe).cfg" "e:\NextLevel\systems\Nintendo NES\10-Yard Fight (USA, Europe).zip"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\nestopia_libretro.dll "E:\NextLevel\systems\Nintendo NES\10-Yard Fight (USA, Europe).zip"
     profile: RetroArch – nestopia
     cwd: E:\NextLevel\emulators\retroarch
only old: -c "{emulatorDir}\config\nintendo nes.cfg" --appendconfig "{emulatorDir}\config\nintendo nes\{romName}.cfg"
```

### 7. emulator — 1 system, 1 variant, 1770 games

Systems: Microsoft MSX.

Example: Microsoft MSX · `007 - A View to a Kill (1986)(Domark)(GB).zip` (1770 games)

```text
old: e:/NextLevel/emulators/openmsx/openmsx.exe -setting e:/NextLevel/emulators/openmsx/share/settings.xml "e:\NextLevel\systems\Microsoft MSX\007 - A View to a Kill (1986)(Domark)(GB).zip"
     cwd: e:\NextLevel\emulators\openmsx
     env: OPENMSX_HOME=e:/NextLevel/emulators/openmsx/
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\bluemsx_libretro.dll "E:\NextLevel\systems\Microsoft MSX\007 - A View to a Kill (1986)(Domark)(GB).zip"
     profile: RetroArch – bluemsx
     cwd: E:\NextLevel\emulators\retroarch
only old: -setting e:\nextlevel\emulators\openmsx\share\settings.xml
only new: -l {emulatorDir}\cores\bluemsx_libretro.dll
```

### 8. newError — 3 systems, 3 variants, 1096 games

Systems: DICE, Funtech Super Acan, Nintendo Game Boy Advance 2 Players.

Example: Nintendo Game Boy Advance 2 Players · `007 - NightFire (USA, Europe) (En,Fr,De).zip` (1061 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\None.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo Game Boy Advance 2 Players.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo Game Boy Advance 2 Players\007 - NightFire (USA, Europe) (En,Fr,De).cfg" "e:\roms\Nintendo Game Boy Advance 2 Players\007 - NightFire (USA, Europe) (En,Fr,De).zip"
     cwd: e:\NextLevel\emulators\retroarch
new: ERROR NO_PROFILE
```

### 9. args — 1 system, 1 variant, 1075 games

Systems: Acorn BBC Micro.

Example: Acorn BBC Micro · `Acid Drops (Europe).zip` (1075 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe bbcb -rp "e:\NextLevel\systems\Acorn BBC Micro" -artpath "e:\NextLevel\systems\Acorn BBC Micro/media/mame/artwork" -flop1 "e:\NextLevel\systems\Acorn BBC Micro\Acid Drops (Europe).zip" -autoboot_delay 3 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Acorn BBC Micro"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe bbcb -rp "E:\NextLevel\systems\Acorn BBC Micro" -artpath "E:\NextLevel\systems\Acorn BBC Micro/media/mame/artwork" -flop1 "E:\NextLevel\systems\Acorn BBC Micro\Acid Drops (Europe).zip" -skip_gameinfo
     profile: MAME – Acorn BBC Micro
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 3 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del -rompath {systemDir}
```

### 10. newError — 2 systems, 5 variants, 1029 games

Systems: Microsoft XBLA, Microsoft XBOX 360.

Example: Microsoft XBLA · `'Splosion Man.xbox360` (721 games)

```text
old: "e:/NextLevel/emulators/xenia/Emulators/Xenia Canary/xenia_canary.exe" --fullscreen "e:\roms\Microsoft XBLA\'Splosion Man (World)\5841098F\000D0000\E42409217241BEFFDAE1EFBA10F7DA460283CFB358"
     cwd: e:\NextLevel\emulators\xenia\Emulators\Xenia Canary
new: ERROR NO_PROFILE
```

### 11. newError — 1 system, 1 variant, 943 games

Systems: Visual Pinball.

Example: Visual Pinball · `007 Goldeneye (Sega 1996) 1.4 JPJ - TeamPP.vpx` (943 games)

```text
old: e:/NextLevel/emulators/vpinball/VPinballX64.exe -ExtMinimized -Ini e:/NextLevel/emulators/vpinball/VPinballX.ini -play "e:\NextLevel\systems\Visual Pinball\007 Goldeneye (Sega 1996) 1.4 JPJ - TeamPP.vpx"
     cwd: e:\NextLevel\emulators\vpinball
new: ERROR NO_PROFILE
```

### 12. newError — 1 system, 3 variants, 928 games

Systems: Microsoft Windows 3.x.

Example: Microsoft Windows 3.x · `101 Dalmatians - Escape From DeVil Manor.pc` (888 games)

```text
old: e:/NextLevel/emulators/dosbox/dosbox.exe "e:\NextLevel\systems\Microsoft Windows 3.x\101 Dalmatians - Escape From DeVil Manor.pc\dosbox.bat" -conf "e:\NextLevel\systems\Microsoft Windows 3.x\101 Dalmatians - Escape From DeVil Manor.pc\dosbox.cfg" -fullscreen -noconsole -exit -c "set ROOT=e:\NextLevel\systems\Microsoft Windows 3.x\101 Dalmatians - Escape From DeVil Manor.pc"
     cwd: e:\NextLevel\emulators\dosbox
new: ERROR NO_PROFILE
```

### 13. args — 1 system, 1 variant, 635 games

Systems: ScummVM.

Example: ScummVM · `+AGS/2080 Wall City Lockdown (USA) (AGS).squashfs` (635 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\scummvm_libretro.dll -c e:/NextLevel/emulators/retroarch/config\ScummVM.cfg --appendconfig "e:/NextLevel/emulators/retroarch/config\ScummVM\2080 Wall City Lockdown (USA) (AGS).cfg" "<squashfs mount>\" --set-shader e:/NextLevel/emulators/retroarch/shaders\shaders_slang/hqx/hq4x.slangp
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\roms\ScummVM\+AGS\2080 Wall City Lockdown (USA) (AGS).squashfs → (root)
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\scummvm_libretro.dll "e:\roms\ScummVM\+AGS\2080 Wall City Lockdown (USA) (AGS).squashfs"
     profile: RetroArch – scummvm
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>" --set-shader {emulatorDir}\shaders\shaders_slang\hqx\hq4x.slangp
only new: {rom}
```

### 14. emulator — 11 systems, 11 variants, 612 games

Systems: Acorn BBC Micro, Brainchild PLS-1000, Coleco Adam, Creatronic Mega Duck, Fairchild Channel F, Gamate, Philips CD-i, Sega SC-3000, Thomson MO5, VTech Creativision, VTech Socrates.

Example: Thomson MO5 · `1000 Bornes (mo5).k7` (252 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\None.dll -c "e:/NextLevel/emulators/retroarch/config\Thomson MO5.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Thomson MO5\1000 Bornes (mo5).cfg" "e:\NextLevel\systems\Thomson MO5\1000 Bornes (mo5).k7"
     cwd: e:\NextLevel\emulators\retroarch
new: e:\NextLevel\emulators\mame\mame.exe mo5 -cass "E:\NextLevel\systems\Thomson MO5\1000 Bornes (mo5).k7" -autoboot_delay 5 -autoboot_command RUN""\n -rompath "E:\NextLevel\systems\Thomson MO5" -skip_gameinfo
     profile: MAME – Thomson MO5
     cwd: e:\NextLevel\emulators\mame
only old: -l e:\nextlevel\emulators\retroarch\cores\none.dll (missing) -c e:\nextlevel\emulators\retroarch\config\{system}.cfg --appendconfig e:\nextlevel\emulators\retroarch\config\{system}\{romName}.cfg (missing)
only new: mo5 -cass -autoboot_delay 5 -autoboot_command run""\n -rompath {systemDir} -skip_gameinfo
```

### 15. args — 1 system, 1 variant, 608 games

Systems: Nintendo Wii U.

Example: Nintendo Wii U · `007 Legends (USA).wua` (608 games)

```text
old: e:/NextLevel/emulators/cemu/Cemu.exe -f "-g=e:\NextLevel\systems\Nintendo Wii U\007 Legends (USA).wua"
     cwd: e:\NextLevel\emulators\cemu
new: e:\NextLevel\emulators\cemu\Cemu.exe -f -g "e:\roms\Nintendo Wii U\007 Legends (USA).wua"
     profile: Cemu
     cwd: e:\NextLevel\emulators\cemu
     note: ROM file not found
only old: -g={rom}
only new: -g {rom}
```

### 16. bothError — 7 systems, 8 variants, 592 games

Systems: Commodore 128, Commodore Max Machine, Elektronska Industrija Pecom 64, Enterprise 128, Flash Games, Singe, Solarus RPG Game Engine.

Example: Flash Games · `supersmashflashexe/00000003.swf` (351 games)

```text
old: ERROR main.cjs leaves undefined\ in the command
new: ERROR NO_PROFILE
```

### 17. args — 1 system, 1 variant, 432 games

Systems: Tandy TRS-80 Color Computer.

Example: Tandy TRS-80 Color Computer · `3D Brickaway (Avalon Hill).cas` (432 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe coco3 -%MEDIA% "e:\NextLevel\systems\Tandy TRS-80 Color Computer\3D Brickaway (Avalon Hill).cas" -autoboot_delay 5 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80 Color Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe coco3 -cart "E:\NextLevel\systems\Tandy TRS-80 Color Computer\3D Brickaway (Avalon Hill).cas" -rompath "E:\NextLevel\systems\Tandy TRS-80 Color Computer" -skip_gameinfo
     profile: MAME – Tandy TRS-80 Color Computer
     cwd: e:\NextLevel\emulators\mame
only old: -%media% -autoboot_delay 5 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 18. newError — 3 systems, 3 variants, 431 games

Systems: Microsoft MSX Turbo R, Microsoft MSX2, Microsoft MSX2+.

Example: Microsoft MSX2 · `# MSXDEV` (325 games)

```text
old: e:/NextLevel/emulators/openmsx/openmsx.exe -setting e:/NextLevel/emulators/openmsx/share/settings.xml "e:\NextLevel\systems\Microsoft MSX2\# MSXDEV"
     cwd: e:\NextLevel\emulators\openmsx
new: ERROR NO_PROFILE
     note: not in the library
```

### 19. newError — 36 systems, 36 variants, 429 games

Systems: Arcade PC, Examu eX-BOARD, Gaelco PC, Gamewax PC, Global VR, IT Nighthawk, Midway PC, Namco BNA, Namco ESX, Namco N2, Namco System 147, Namco System 148, Namco System 246, Namco System 256, Namco System 369, Phantom Systems, Raw Thrills, Sega ALLs, Sega Europa-R, Sega Lindbergh, Sega PC, Sega RingEdge, Sega RingEdge 2, Sega RingWide, Sega Triforce and 11 more.

Example: Taito NESiCAxLive · `3DCosplayMahjong.squashfs` (49 games)

```text
old: e:/NextLevel/emulators/TeknoParrot/TeknoParrotUi.exe --profile=3DCosplayMahjong.xml --startMinimized
     cwd: e:\NextLevel\emulators\TeknoParrot
     mounts first: e:\NextLevel\systems\Taito NESiCAxLive\3DCosplayMahjong.squashfs → (root)
new: ERROR NO_PROFILE
```

### 20. newError — 1 system, 2 variants, 379 games

Systems: Future Pinball.

Example: Future Pinball · `007 Casino Royale (Original) (1.1).fpt` (378 games)

```text
old: "e:/NextLevel/emulators/fpinball/Future Pinball.exe" /open "e:\NextLevel\systems\Future Pinball\007 Casino Royale (Original) (1.1).fpt" /play /exit
     cwd: e:\NextLevel\emulators\fpinball
new: ERROR NO_PROFILE
```

### 21. newError — 1 system, 1 variant, 376 games

Systems: Sony Playstation 3.

Example: Sony Playstation 3 · `007 Legends (USA) (En,Fr).m3u` (376 games)

```text
old: TODO
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 22. newError — 1 system, 1 variant, 369 games

Systems: OpenBOR.

Example: OpenBOR · `A Tale of Vengeance.pak` (369 games)

```text
old: e:/NextLevel/emulators/openbor/OpenBOR.exe "e:\NextLevel\systems\OpenBOR\A Tale of Vengeance.pak"
     cwd: e:\NextLevel\emulators\openbor
new: ERROR NO_PROFILE
```

### 23. newError — 4 systems, 4 variants, 303 games

Systems: Hitachi Basic Master Level 3, Luxor ABC 80, Nichibutsu My Vision, Specialist.

Example: Specialist · `adskok.zip` (161 games)

```text
old: e:\NextLevel\systems\Specialist\retroarch.bat special cass e:\NextLevel\systems\Specialist\adskok.zip
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 24. newError — 2 systems, 2 variants, 270 games

Systems: Big Fish Games, GameHouse Games.

Example: Big Fish Games · `10 Talismans.wsquashfs` (155 games)

```text
old: "<squashfs mount>\" ""
     cwd: (launcher folder)
     mounts first: e:\NextLevel\systems\Big Fish Games\10 Talismans.wsquashfs → (root)
new: ERROR NO_PROFILE
```

### 25. emulator — 1 system, 1 variant, 241 games

Systems: Microsoft XBOX.

Example: Microsoft XBOX · `Voodoo Vince (Europe) (En,Fr,De,Es).iso` (241 games)

```text
old: e:/NextLevel/emulators/xemu/xemu.exe -full-screen -dvd_path "e:\roms\Microsoft XBOX\Voodoo Vince (Europe) (En,Fr,De,Es).iso"
     cwd: e:\NextLevel\emulators\xemu
new: e:\NextLevel\emulators\xemu-chihiro-PLAYTEST-1\xemu.exe -full-screen -dvd_path "e:\roms\Microsoft XBOX\Voodoo Vince (Europe) (En,Fr,De,Es).iso"
     profile: xemu
     cwd: e:\NextLevel\emulators\xemu-chihiro-PLAYTEST-1
```

### 26. args — 1 system, 1 variant, 219 games

Systems: NEC PC-6001.

Example: NEC PC-6001 · `3D Asteroid Fire (m2p4).cas` (219 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe pc6001 -%MEDIA% "e:\NextLevel\systems\NEC PC-6001\3D Asteroid Fire (m2p4).cas" -autoboot_delay 4 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\NEC PC-6001"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe pc6001 -cart1 "E:\NextLevel\systems\NEC PC-6001\3D Asteroid Fire (m2p4).cas" -rompath "E:\NextLevel\systems\NEC PC-6001" -skip_gameinfo
     profile: MAME – NEC PC-6001
     cwd: e:\NextLevel\emulators\mame
only old: -%media% -autoboot_delay 4 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart1
```

### 27. emulator — 1 system, 1 variant, 206 games

Systems: Nintendo Switch.

Example: Nintendo Switch · `1917 - The Alien Invasion DX.nsp` (206 games)

```text
old: e:/NextLevel/emulators/yuzu/yuzu.exe -f -g "e:\roms\Nintendo Switch\1917 - The Alien Invasion DX.nsp"
     cwd: e:\NextLevel\emulators\yuzu
new: e:\NextLevel\emulators\ryubing\Ryujinx.exe -f "e:\roms\Nintendo Switch\1917 - The Alien Invasion DX.nsp"
     profile: Ryujinx
     cwd: e:\NextLevel\emulators\ryubing
only old: -g
```

### 28. newError — 2 systems, 2 variants, 189 games

Systems: Pinball FX2, Pinball FX3.

Example: Pinball FX3 · `Alien_Isolation.bat` (100 games)

```text
old: "e:\NextLevel\systems\Pinball FX3\Alien_Isolation.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 29. args — 2 systems, 2 variants, 165 games

Systems: Exidy Sorcerer, Fujitsu FM-7.

Example: Fujitsu FM-7 · `1942 (1987)(ASCII)(JP).zip` (109 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe fm7 -flop1 "e:\NextLevel\systems\Fujitsu FM-7\1942 (1987)(ASCII)(JP).zip" -autoboot_delay 2 -autoboot_command "" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Fujitsu FM-7"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe fm7 -flop1 "E:\NextLevel\systems\Fujitsu FM-7\1942 (1987)(ASCII)(JP).zip" -rompath "E:\NextLevel\systems\Fujitsu FM-7" -skip_gameinfo
     profile: MAME – Fujitsu FM-7
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 30. bothError — 1 system, 1 variant, 164 games

Systems: Sony PS Vita.

Example: Sony PS Vita · `Crimsonland.cmd` (164 games)

```text
old: ERROR FileNotFoundError: CMD file not found: e:\NextLevel\systems\Sony PS Vita\Crimsonland.cmd
new: ERROR NO_PROFILE
```

### 31. newError — 1 system, 1 variant, 134 games

Systems: Pinball FX.

Example: Pinball FX · `A Charlie Brown Christmas Pinball.table` (134 games)

```text
old: "e:/PC-Games/Pinball FX/pinballfx.exe" -Table 181
     cwd: e:\PC-Games\Pinball FX
new: ERROR NO_PROFILE
```

### 32. newError — 1 system, 1 variant, 133 games

Systems: Nintendo NES 3D.

Example: Nintendo NES 3D · `1943 - The Battle of Midway.cmd` (133 games)

```text
old: "e:\NextLevel\systems\Nintendo NES 3D\1943 - The Battle of Midway.cmd" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 33. args — 1 system, 1 variant, 124 games

Systems: Tandy TRS-80.

Example: Tandy TRS-80 · `AdamsAdventures2.DSK` (124 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe trs80m3 - "e:\NextLevel\systems\Tandy TRS-80\AdamsAdventures2.DSK" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe trs80m3 -cass "E:\NextLevel\systems\Tandy TRS-80\AdamsAdventures2.DSK" -rompath "E:\NextLevel\systems\Tandy TRS-80" -skip_gameinfo
     profile: MAME – Tandy TRS-80
     cwd: e:\NextLevel\emulators\mame
only old: - -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 34. newError — 1 system, 1 variant, 122 games

Systems: Zaccaria Pinball.

Example: Zaccaria Pinball · `Aerobatics.bat` (122 games)

```text
old: "e:\NextLevel\systems\Zaccaria Pinball\Aerobatics.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 35. args — 1 system, 121 variants, 121 games

Systems: LCD Games.

Example: LCD Games · `nupogodi.zip` (1 game) — `core=nupogodi.zip`, `artfolder=artwork_alt`

```text
old: e:/NextLevel/emulators/mame/mame.exe nupogodi.zip -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\LCD Games" -artpath e:/NextLevel/emulators/mame/artwork_alt -cfg_directory e:/NextLevel/emulators/mame/cfg_alt
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe nupogodi.zip -rompath "E:\NextLevel\systems\LCD Games" -skip_gameinfo
     profile: MAME – LCD Games
     cwd: e:\NextLevel\emulators\mame
only old: -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del -artpath {emulatorDir}\artwork_alt -cfg_directory {emulatorDir}\cfg_alt
```

### 36. args — 1 system, 1 variant, 112 games

Systems: Acorn Atom.

Example: Acorn Atom · `galaxian.zip` (112 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe atom -%MEDIA% "e:\NextLevel\systems\Acorn Atom\galaxian.zip" -keyboardprovider dinput -autoboot_delay 2 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Acorn Atom"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe atom -cass "E:\NextLevel\systems\Acorn Atom\galaxian.zip" -keyboardprovider dinput -rompath "E:\NextLevel\systems\Acorn Atom" -skip_gameinfo
     profile: MAME – Acorn Atom
     cwd: e:\NextLevel\emulators\mame
only old: -%media% -autoboot_delay 2 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 37. newError — 1 system, 1 variant, 105 games

Systems: PinballArcade.

Example: PinballArcade · `ACDC.bat` (105 games)

```text
old: e:\NextLevel\systems\PinballArcade\ACDC.bat none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 38. bothError — 1 system, 2 variants, 92 games

Systems: Arcade Gun Games.

Example: Arcade Gun Games · `Assault City (Europe).zip` (91 games)

```text
old: ERROR main.cjs leaves %RETROARCH_PATH%, %name%, undefined\ in the command
new: ERROR NO_PROFILE
```

### 39. emulator — 1 system, 1 variant, 88 games

Systems: Coleco ColecoVision.

Example: Coleco ColecoVision · `Astrododge (USA) (Unl).rom` (88 games) — `emulator=colem`

```text
old: e:/NextLevel/emulators/ColEm56/ColEm.exe -sgm "e:\NextLevel\systems\Coleco ColecoVision\Astrododge (USA) (Unl).rom"
     cwd: e:\NextLevel\emulators\ColEm56
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\bluemsx_libretro.dll "E:\NextLevel\systems\Coleco ColecoVision\Astrododge (USA) (Unl).rom"
     profile: RetroArch – bluemsx
     cwd: E:\NextLevel\emulators\retroarch
only old: -sgm
only new: -l {emulatorDir}\cores\bluemsx_libretro.dll
```

### 40. args — 5 systems, 5 variants, 77 games

Systems: Amstrad CPC Plus, Camputers Lynx, Canon X-07, CCE MC-1000, Matra and Hachette Alice.

Example: Camputers Lynx · `3D Monster Craze (1983)(Camsoft)(GB).tap` (31 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe lynx48k -cass1 "e:\NextLevel\systems\Camputers Lynx\3D Monster Craze (1983)(Camsoft)(GB).tap" -autoboot_delay 2 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Camputers Lynx"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe lynx48k -cass1 "E:\NextLevel\systems\Camputers Lynx\3D Monster Craze (1983)(Camsoft)(GB).tap" -rompath "E:\NextLevel\systems\Camputers Lynx" -skip_gameinfo
     profile: MAME – Camputers Lynx
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 41. args — 2 systems, 72 variants, 72 games

Systems: Nintendo NES MSU-1, Nintendo SNES MSU-1.

Example: Nintendo NES MSU-1 · `Contra SNES.wsquashfs` (1 game) — `squashfs_exe=Contra SNES.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1\Contra SNES.cfg" "<squashfs mount>\Contra SNES.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo NES MSU-1\Contra SNES.wsquashfs → Contra SNES.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo NES MSU-1\Contra SNES.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\{romName}.sfc"
only new: {rom}
```

### 42. args — 2 systems, 2 variants, 70 games

Systems: Memotech MTX, NEC PC-8001.

Example: Memotech MTX · `3D Tachyon Fighter.mtx` (44 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe mtx512 -dump "e:\NextLevel\systems\Memotech MTX\3D Tachyon Fighter.mtx" -autoboot_delay 4 -autoboot_command "" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Memotech MTX"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe mtx512 -dump "E:\NextLevel\systems\Memotech MTX\3D Tachyon Fighter.mtx" -rompath "E:\NextLevel\systems\Memotech MTX" -skip_gameinfo
     profile: MAME – Memotech MTX
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 4 -autoboot_command -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 43. newError — 1 system, 1 variant, 68 games

Systems: MUGEN.

Example: MUGEN · `Super Crazy Jam Season 2.lnk` (68 games)

```text
old: "e:/NextLevel/systems/MUGEN/Super Crazy Jam Season 2.lnk"
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 44. newError — 5 systems, 67 variants, 67 games

Systems: CoolBoy, Epoch SSD Company, JungleTac, Musical, Other Handhelds.

Example: CoolBoy · `mc_110cb.zip` (1 game) — `core=mc_110cb`

```text
old: e:/NextLevel/emulators/mame/mame.exe mc_110cb -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Retro Game Systems"
     cwd: e:\NextLevel\emulators\mame
new: ERROR NO_PROFILE
```

### 45. newError — 2 systems, 2 variants, 67 games

Systems: Sega Model 2, Sega Model 3.

Example: Sega Model 2 · `bel.zip` (42 games)

```text
old: e:/NextLevel/emulators/m2emulator/emulator.bat bel
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 46. args — 1 system, 6 variants, 60 games

Systems: Arcade.

Example: Arcade · `arabian.zip` (40 games) — `core=fbneo_libretro`, `config=arcade-hyperspacemadnessarcade`, `alt_game_config=hyperspacemadnessarcade`, `shader=shaders_slang/hqx/hq4x.slangp`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\fbneo_libretro.dll -c e:/NextLevel/emulators/retroarch/config\arcade-hyperspacemadnessarcade.cfg --appendconfig e:/NextLevel/emulators/retroarch/config\Arcade\hyperspacemadnessarcade\arabian.cfg e:\roms\Arcade\arabian.zip --set-shader e:/NextLevel/emulators/retroarch/shaders\shaders_slang/hqx/hq4x.slangp
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\fbneo_libretro.dll --appendconfig e:\NextLevel\emulators\retroarch\config\arcade-hyperspacemadnessarcade.cfg|e:\NextLevel\emulators\retroarch\config\Arcade\hyperspacemadnessarcade\arabian.cfg --set-shader e:\NextLevel\emulators\retroarch\shaders\shaders_slang\hqx\hq4x.slangp e:\roms\Arcade\arabian.zip
     profile: RetroArch – fbneo
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\arcade-hyperspacemadnessarcade.cfg {emulatorDir}\config\{system}\hyperspacemadnessarcade\{romName}.cfg
only new: {emulatorDir}\config\arcade-hyperspacemadnessarcade.cfg|{emulatorDir}\config\{system}\hyperspacemadnessarcade\{romName}.cfg
```

### 47. bothError — 3 systems, 3 variants, 51 games

Systems: Doujin Soft Beatemups, Doujin Soft Shmups, Touhou Project.

Example: Touhou Project · `10.5th - Scarlet Weather Rhapsody` (28 games)

```text
old: ERROR main.cjs leaves %name% in the command
new: ERROR NO_PROFILE
```

### 48. newError — 1 system, 1 variant, 51 games

Systems: Nokia N-GAGE.

Example: Nokia N-GAGE · `Ashen.cmd` (51 games)

```text
old: "e:\NextLevel\systems\Nokia N-GAGE\Ashen.cmd" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 49. newError — 1 system, 1 variant, 48 games

Systems: Namco System 2x6.

Example: Namco System 2x6 · `Ace Driver 3.acgame` (48 games)

```text
old: e:/NextLevel/emulators/pcsx2x6/pcsx2-qt.exe -fullscreen -- "e:\roms\Namco System 2x6\Ace Driver 3.acgame"
     cwd: e:\NextLevel\emulators\pcsx2x6
new: ERROR NO_PROFILE
```

### 50. newError — 1 system, 1 variant, 46 games

Systems: PopCap Games.

Example: PopCap Games · `Alchemy Deluxe.lnk` (46 games)

```text
old: "e:/NextLevel/systems/PopCap Games/Alchemy Deluxe.lnk"
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 51. newError — 4 systems, 4 variants, 42 games

Systems: Cave 3rd, Gaelco 3D, Sega Hikaru, Sega Naomi 2 GD-ROM.

Example: Cave 3rd · `ddpdfk.zip` (25 games)

```text
old: e:/NextLevel/emulators/demul07_111117/demul.exe -run=cave3rd -rom=ddpdfk.zip
     cwd: e:\NextLevel\emulators\demul07_111117
new: ERROR NO_PROFILE
```

### 52. args — 1 system, 1 variant, 42 games

Systems: Sega SC-3000.

Example: Sega SC-3000 · `Bank Panic (Japan).zip` (42 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe sc3000 -None "e:\NextLevel\systems\Sega SC-3000\Bank Panic (Japan).zip" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Sega SC-3000"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe sc3000 -cart "E:\NextLevel\systems\Sega SC-3000\Bank Panic (Japan).zip" -rompath "E:\NextLevel\systems\Sega SC-3000" -skip_gameinfo
     profile: MAME – Sega SC-3000
     cwd: e:\NextLevel\emulators\mame
only old: -none -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 53. args — 1 system, 1 variant, 39 games

Systems: Mattel Aquarius.

Example: Mattel Aquarius · `breakout.zip` (39 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe aquarius -%MEDIA% "e:\NextLevel\systems\Mattel Aquarius\breakout.zip" -autoboot_delay 4 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Mattel Aquarius"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe aquarius -cart "E:\NextLevel\systems\Mattel Aquarius\breakout.zip" -rompath "E:\NextLevel\systems\Mattel Aquarius" -skip_gameinfo
     profile: MAME – Mattel Aquarius
     cwd: e:\NextLevel\emulators\mame
only old: -%media% -autoboot_delay 4 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 54. newError — 1 system, 1 variant, 35 games

Systems: AAE.

Example: AAE · `asteroid.zip` (35 games)

```text
old: e:/NextLevel/emulators/AAE/run.bat asteroid.zip
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 55. newError — 4 systems, 4 variants, 35 games

Systems: Daphne, Mattel Captain Power, Sega Video Driver, WoW Action Max.

Example: Daphne · `ace.wsquashfs` (19 games)

```text
old: e:/NextLevel/emulators/hypseus_singe/hypseus.exe ace vldp -framefile "<squashfs mount>\ace.txt" -fullscreen -opengl -fastboot -force_aspect_ratio
     cwd: e:\NextLevel\emulators\hypseus_singe
     mounts first: e:\roms\Daphne\ace.wsquashfs → ace
new: ERROR NO_PROFILE
```

### 56. oldError — 1 system, 1 variant, 33 games

Systems: Timex Sinclair 2068.

Example: Timex Sinclair 2068 · `2048-Emu.dck` (33 games)

```text
old: ERROR main.cjs leaves %FUSE_PATH%, undefined\ in the command
new: e:\NextLevel\emulators\mame\mame.exe ts2068 -cart "E:\NextLevel\systems\Timex Sinclair 2068\2048-Emu.dck" -rompath "E:\NextLevel\systems\Timex Sinclair 2068" -skip_gameinfo
     profile: MAME – Timex Sinclair 2068
     cwd: e:\NextLevel\emulators\mame
```

### 57. newError — 1 system, 1 variant, 32 games

Systems: Nintendo NES HD.

Example: Nintendo NES HD · `25th Anniversary Super Mario Bros. (Europe) (Promo, Virtual Console).bat` (32 games)

```text
old: "e:\NextLevel\systems\Nintendo NES HD\25th Anniversary Super Mario Bros. (Europe) (Promo, Virtual Console).bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 58. bothError — 1 system, 1 variant, 31 games

Systems: Philips Videopac Plus G7400.

Example: Philips Videopac Plus G7400 · `Air Battle (Europe)` (31 games)

```text
old: ERROR Error: Unknown system 'Philips Videopac Plus G7400'
new: ERROR NO_PROFILE
```

### 59. emulator — 2 systems, 2 variants, 30 games

Systems: Amstrad GX4000, Arcade.

Example: Amstrad GX4000 · `! Homebrews/Blinky's Scary School v1.3 (2023-01-31)(Zisquier).zip` (25 games) — `emulator=mame`

```text
old: e:/NextLevel/emulators/mame/mame.exe gx4000 -cart "e:\NextLevel\systems\Amstrad GX4000\! Homebrews\Blinky's Scary School v1.3 (2023-01-31)(Zisquier).zip" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Amstrad GX4000"
     cwd: e:\NextLevel\emulators\mame
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\cap32_libretro.dll "E:\NextLevel\systems\Amstrad GX4000\! Homebrews\Blinky's Scary School v1.3 (2023-01-31)(Zisquier).zip"
     profile: RetroArch – cap32
     cwd: E:\NextLevel\emulators\retroarch
only old: gx4000 -cart -artpath e:\nextlevel\emulators\mame\artwork -cfg_directory e:\nextlevel\emulators\mame\cfg -snapshot_directory e:\nextlevel\emulators\mame\snap -nvram_directory e:\nextlevel\emulators\mame\nvram -diff_directory e:\nextlevel\emulators\mame\diff -hashpath e:\nextlevel\emulators\mame\hash -languagepath e:\nextlevel\emulators\mame\language -inipath e:\nextlevel\emulators\mame -uimodekey del -skip_gameinfo -rompath {systemDir}
only new: -l {emulatorDir}\cores\cap32_libretro.dll
```

### 60. bothError — 1 system, 1 variant, 29 games

Systems: Konami PC.

Example: Konami PC · `Dance Dance Revolution (2013).squashfs` (29 games)

```text
old: ERROR nextlevel-launcher: error: unrecognized arguments: Dance Revolution (2013).squashfs
new: ERROR NO_PROFILE
```

### 61. args — 1 system, 5 variants, 26 games

Systems: Arcade.

Example: Arcade · `1941.zip` (18 games) — `core=fbneo_libretro`, `config=arcade-realistic`, `alt_game_config=realistic`, `shader=shaders_slang/hqx/hq4x.slangp`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\fbneo_libretro.dll -c e:/NextLevel/emulators/retroarch/config\arcade-realistic.cfg --appendconfig e:/NextLevel/emulators/retroarch/config\Arcade\realistic\1941.cfg e:\roms\Arcade\1941.zip --set-shader e:/NextLevel/emulators/retroarch/shaders\shaders_slang/hqx/hq4x.slangp
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\fbneo_libretro.dll --appendconfig e:\NextLevel\emulators\retroarch\config\arcade-realistic.cfg|e:\NextLevel\emulators\retroarch\config\Arcade\realistic\1941.cfg --set-shader e:\NextLevel\emulators\retroarch\shaders\shaders_slang\hqx\hq4x.slangp e:\roms\Arcade\1941.zip
     profile: RetroArch – fbneo
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\arcade-realistic.cfg {emulatorDir}\config\{system}\realistic\{romName}.cfg
only new: {emulatorDir}\config\arcade-realistic.cfg|{emulatorDir}\config\{system}\realistic\{romName}.cfg
```

### 62. args — 1 system, 1 variant, 24 games

Systems: Sony Playstation.

Example: Sony Playstation · `Elemental Gearbolt (USA).chd` (24 games) — `core=mednafen_psx_hw_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\duckstation_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sony Playstation.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sony Playstation\Elemental Gearbolt (USA).cfg" "e:\NextLevel\systems\Sony Playstation\Elemental Gearbolt (USA).chd"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\mednafen_psx_hw_libretro.dll "e:\roms\Sony Playstation\Elemental Gearbolt (USA).chd"
     profile: RetroArch – duckstation
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: {emulatorDir}\cores\duckstation_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg
only new: {emulatorDir}\cores\mednafen_psx_hw_libretro.dll
```

### 63. args — 1 system, 1 variant, 23 games

Systems: Sega Saturn.

Example: Sega Saturn · `! Translated/Grandia (Japan) [T-En by TrekkiesUnite118 v1.1.1].m3u` (23 games) — `core=mednafen_saturn_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\kronos_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sega Saturn.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sega Saturn\Grandia (Japan) [T-En by TrekkiesUnite118 v1.1.1].cfg" "e:\roms\Sega Saturn\! Translated\Grandia (Japan) [T-En by TrekkiesUnite118 v1.1.1].m3u"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\mednafen_saturn_libretro.dll "e:\roms\Sega Saturn\! Translated\Grandia (Japan) [T-En by TrekkiesUnite118 v1.1.1].m3u"
     profile: RetroArch – kronos
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\kronos_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
only new: {emulatorDir}\cores\mednafen_saturn_libretro.dll
```

### 64. bothError — 1 system, 1 variant, 21 games

Systems: Takara Taiko De Popira.

Example: Takara Taiko De Popira · `gc0001.zip` (21 games)

```text
old: ERROR Error: Unknown system 'Takara Taiko De Popira'
new: ERROR NO_PROFILE
```

### 65. newError — 1 system, 1 variant, 18 games

Systems: Remakes.

Example: Remakes · `Abadia Del Crimen.lnk` (18 games)

```text
old: "e:\NextLevel\systems\PC-Games\Abadia Del Crimen.lnk"
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 66. newError — 1 system, 1 variant, 17 games

Systems: Commander X16.

Example: Commander X16 · `Chase Vault.bat` (17 games)

```text
old: "e:\NextLevel\systems\Commander X16\Chase Vault.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 67. args — 1 system, 1 variant, 17 games

Systems: Philips P2000T.

Example: Philips P2000T · `3D Doolhof 2 (19xx)(-)(nl).zip` (17 games)

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\mame_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Philips P2000T.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Philips P2000T\3D Doolhof 2 (19xx)(-)(nl).cfg" "p2000t -cass "e:\NextLevel\systems\Philips P2000T\3D Doolhof 2 (19xx)(-)(nl).zip""
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\mame_libretro.dll "E:\NextLevel\systems\Philips P2000T\3D Doolhof 2 (19xx)(-)(nl).zip"
     profile: RetroArch – mame
     cwd: E:\NextLevel\emulators\retroarch
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "p2000t -cass "{rom}""
only new: {rom}
```

### 68. newError — 1 system, 1 variant, 14 games

Systems: GameMaker Games.

Example: GameMaker Games · `! Jams/! NoneJam 10/Archeo-Raid.lnk` (14 games)

```text
old: "e:/NextLevel/systems/GameMaker Games/! Jams\! NoneJam 10/Archeo-Raid.lnk"
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 69. newError — 1 system, 1 variant, 14 games

Systems: Sega Chihiro.

Example: Sega Chihiro · `Crazy Taxi High Roller.squashfs` (14 games)

```text
old: "e:\NextLevel\systems\Sega Chihiro\Crazy Taxi High Roller.squashfs"
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 70. newError — 1 system, 1 variant, 13 games

Systems: Atari Jaguar CD.

Example: Atari Jaguar CD · `baldies.bat` (13 games) — `core=mame_libretro`

```text
old: "e:\NextLevel\systems\Atari Jaguar CD\baldies.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 71. newError — 1 system, 1 variant, 12 games

Systems: Atari Jaguar CD.

Example: Atari Jaguar CD · `Ants (USA) (Unl).bat` (12 games)

```text
old: "e:\NextLevel\systems\Atari Jaguar CD\Ants (USA) (Unl).bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 72. bothError — 1 system, 1 variant, 10 games

Systems: ICE PC.

Example: ICE PC · `Angry Birds Arcade.squashfs` (10 games)

```text
old: ERROR nextlevel-launcher: error: unrecognized arguments: Birds Arcade.squashfs
new: ERROR NO_PROFILE
```

### 73. newError — 2 systems, 2 variants, 10 games

Systems: Tiger R-Zone, VideoJet Pocket Dream Console.

Example: VideoJet Pocket Dream Console · `dorapdc.zip` (7 games)

```text
old: e:/NextLevel/emulators/mame/mame.exe %CORE% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\VideoJet Pocket Dream Console"
     cwd: e:\NextLevel\emulators\mame
new: ERROR CORE_MISSING
     profile: MAME – VideoJet Pocket Dream Console
```

### 74. bothError — 1 system, 1 variant, 9 games

Systems: Adrenaline PC.

Example: Adrenaline PC · `Drakons.squashfs` (9 games)

```text
old: ERROR Error: Unknown system 'Adrenaline PC'
new: ERROR NO_PROFILE
```

### 75. newError — 2 systems, 2 variants, 8 games

Systems: American Laser Games, Laserdisc.

Example: American Laser Games · `crimepatrol-hd.wsquashfs` (7 games)

```text
old: "e:\NextLevel\systems\American Laser Games\emulator.cmd" "e:\NextLevel\systems\American Laser Games" crimepatrol-hd.wsquashfs
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 76. newError — 1 system, 1 variant, 8 games

Systems: Locomalito Games.

Example: Locomalito Games · `8bit Killer.lnk` (8 games)

```text
old: "e:/NextLevel/systems/Locomalito Games/8bit Killer.lnk"
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 77. newError — 1 system, 1 variant, 8 games

Systems: Pinball M.

Example: Pinball M · `Camp Bloodbrook.table` (8 games)

```text
old: "e:/PC-Games/Pinball M/pinballm.exe" -Table 191
     cwd: e:\PC-Games\Pinball M
new: ERROR NO_PROFILE
```

### 78. args — 1 system, 1 variant, 8 games

Systems: Sega Dreamcast.

Example: Sega Dreamcast · `Bangai-O (USA).chd` (8 games) — `core=redream_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\flycast_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sega Dreamcast.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sega Dreamcast\Bangai-O (USA).cfg" "e:\roms\Sega Dreamcast\Bangai-O (USA).chd"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\redream_libretro.dll "e:\roms\Sega Dreamcast\Bangai-O (USA).chd"
     profile: RetroArch – flycast
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\flycast_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
only new: {emulatorDir}\cores\redream_libretro.dll
```

### 79. bothError — 1 system, 1 variant, 7 games

Systems: Sega Nu.

Example: Sega Nu · `Crossbeats Rev Sunshine.squashfs` (7 games)

```text
old: ERROR nextlevel-launcher: error: unrecognized arguments: Rev Sunshine.squashfs
new: ERROR NO_PROFILE
```

### 80. args — 1 system, 1 variant, 6 games

Systems: Sega CD.

Example: Sega CD · `Slam City with Scottie Pippen (USA) (Disc 1) (Fingers) (Sega CD 32X).chd` (6 games) — `core=picodrive_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\genesis_plus_gx_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sega CD.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sega CD\Slam City with Scottie Pippen (USA) (Disc 1) (Fingers) (Sega CD 32X).cfg" "e:\roms\Sega CD\Slam City with Scottie Pippen (USA) (Disc 1) (Fingers) (Sega CD 32X).chd"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\picodrive_libretro.dll "e:\roms\Sega CD\Slam City with Scottie Pippen (USA) (Disc 1) (Fingers) (Sega CD 32X).chd"
     profile: RetroArch – genesis_plus_gx
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\genesis_plus_gx_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
only new: {emulatorDir}\cores\picodrive_libretro.dll
```

### 81. newError — 1 system, 1 variant, 6 games

Systems: VM Labs Nuon.

Example: VM Labs Nuon · `Ballistic.bat` (6 games)

```text
old: "e:\NextLevel\systems\VM Labs Nuon\Ballistic.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 82. bothError — 1 system, 1 variant, 4 games

Systems: Millennium.

Example: Millennium · `marc101.zip` (4 games)

```text
old: ERROR main.cjs leaves %name% in the command
new: ERROR CORE_MISSING
     profile: MAME – Millennium
```

### 83. bothError — 1 system, 1 variant, 3 games

Systems: Cave PC.

Example: Cave PC · `Deathsmiles2.squashfs` (3 games)

```text
old: ERROR Error: Unknown system 'Cave PC'
new: ERROR NO_PROFILE
```

### 84. bothError — 1 system, 1 variant, 3 games

Systems: Coastal PC.

Example: Coastal PC · `WildWestShootout.parrot` (3 games)

```text
old: ERROR Error: Unknown system 'Coastal PC'
new: ERROR NO_PROFILE
```

### 85. args — 1 system, 3 variants, 3 games

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Earthbound (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=Earthbound (US) (MSU-1).smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Earthbound (US) (MSU-1).cfg" "<squashfs mount>\Earthbound (US) (MSU-1).smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Earthbound (US) (MSU-1).wsquashfs → Earthbound (US) (MSU-1).smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Earthbound (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\{romName}.smc"
only new: {rom}
```

### 86. args — 1 system, 1 variant, 3 games

Systems: Sega Saturn.

Example: Sega Saturn · `Battle Arena Toshinden URA (USA).chd` (3 games) — `core=yabasanshiro_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\kronos_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sega Saturn.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sega Saturn\Battle Arena Toshinden URA (USA).cfg" "e:\roms\Sega Saturn\Battle Arena Toshinden URA (USA).chd"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\yabasanshiro_libretro.dll "e:\roms\Sega Saturn\Battle Arena Toshinden URA (USA).chd"
     profile: RetroArch – kronos
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\kronos_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
only new: {emulatorDir}\cores\yabasanshiro_libretro.dll
```

### 87. bothError — 1 system, 1 variant, 3 games

Systems: Taito Type X3.

Example: Taito Type X3 · `Left 4 Dead -Survivors-.squashfs` (3 games)

```text
old: ERROR nextlevel-launcher: error: unrecognized arguments: 4 Dead -Survivors-.squashfs
new: ERROR NO_PROFILE
```

### 88. args — 2 systems, 2 variants, 2 games

Systems: Canon X-07, Matra and Hachette Alice.

Example: Canon X-07 · `amidar.zip` (1 game) — `launch_args=CLOAD\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe x07 -cass "e:\NextLevel\systems\Canon X-07\amidar.zip" -autoboot_delay 2 -autoboot_command CLOAD\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Canon X-07"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe x07 -cass "E:\NextLevel\systems\Canon X-07\amidar.zip" -rompath "E:\NextLevel\systems\Canon X-07" -skip_gameinfo
     profile: MAME – Canon X-07
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command cload\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 89. emulator — 1 system, 1 variant, 2 games

Systems: Commodore Plus4.

Example: Commodore Plus4 · `! Homebrews/ghosts_n_goblins_arcade_version.d64` (2 games) — `emulator=yape`

```text
old: e:/NextLevel/emulators/yapeSDL_0.80.1_x64/YapeSDL.exe "e:\NextLevel\systems\Commodore Plus4\! Homebrews\ghosts_n_goblins_arcade_version.d64"
     cwd: e:\NextLevel\emulators\yapeSDL_0.80.1_x64
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\vice_xplus4_libretro.dll "E:\NextLevel\systems\Commodore Plus4\! Homebrews\ghosts_n_goblins_arcade_version.d64"
     profile: RetroArch – vice_xplus4
     cwd: E:\NextLevel\emulators\retroarch
only new: -l {emulatorDir}\cores\vice_xplus4_libretro.dll
```

### 90. bothError — 1 system, 1 variant, 2 games

Systems: Konami Viper.

Example: Konami Viper · `Jurassic Park III (UBC).squashfs` (2 games)

```text
old: ERROR nextlevel-launcher: error: unrecognized arguments: Park III (UBC).squashfs
new: ERROR NO_PROFILE
```

### 91. args — 1 system, 1 variant, 1 game

Systems: Acorn Atom.

Example: Acorn Atom · `egghead.zip` (1 game) — `launch_args=*DOS\n*RUN\"EHRUN\"\n`, `mame_media=flop1`

```text
old: e:/NextLevel/emulators/mame/mame.exe atom -flop1 "e:\NextLevel\systems\Acorn Atom\egghead.zip" -keyboardprovider dinput -autoboot_delay 2 -autoboot_command *DOS\n*RUN\EHRUN\\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Acorn Atom"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe atom -cass "E:\NextLevel\systems\Acorn Atom\egghead.zip" -keyboardprovider dinput -rompath "E:\NextLevel\systems\Acorn Atom" -skip_gameinfo
     profile: MAME – Acorn Atom
     cwd: e:\NextLevel\emulators\mame
only old: -flop1 -autoboot_delay 2 -autoboot_command *dos\n*run\ehrun\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 92. args — 1 system, 1 variant, 1 game

Systems: Acorn BBC Micro.

Example: Acorn BBC Micro · `Arkanoid (Europe).zip` (1 game) — `emulator=mame`, `launch_args=*B.\nCH.\"LOAD\"\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe bbcb -rp "e:\NextLevel\systems\Acorn BBC Micro" -artpath "e:\NextLevel\systems\Acorn BBC Micro/media/mame/artwork" -flop1 "e:\NextLevel\systems\Acorn BBC Micro\Arkanoid (Europe).zip" -autoboot_delay 3 -autoboot_command *B.\nCH.\LOAD\\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Acorn BBC Micro"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe bbcb -rp "E:\NextLevel\systems\Acorn BBC Micro" -artpath "E:\NextLevel\systems\Acorn BBC Micro/media/mame/artwork" -flop1 "E:\NextLevel\systems\Acorn BBC Micro\Arkanoid (Europe).zip" -skip_gameinfo
     profile: MAME – Acorn BBC Micro
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 3 -autoboot_command *b.\nch.\load\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del -rompath {systemDir}
```

### 93. emulator — 1 system, 1 variant, 1 game

Systems: Adventure Game Studio.

Example: Adventure Game Studio · `Maniac Mansion Deluxe.bat` (1 game)

```text
old: "e:\NextLevel\systems\Adventure Game Studio\Maniac Mansion Deluxe.bat" none
     cwd: (launcher folder)
new: e:\NextLevel\emulators\scummvm-2026.2.0-win32-x86_64\scummvm.exe --fullscreen --auto-detect "--path=E:\NextLevel\systems\Adventure Game Studio"
     profile: ScummVM
     cwd: e:\NextLevel\emulators\scummvm-2026.2.0-win32-x86_64
only old: none
only new: --fullscreen --auto-detect --path={systemDir}
```

### 94. args — 1 system, 1 variant, 1 game

Systems: Amstrad CPC Plus.

Example: Amstrad CPC Plus · `Frogger (CPC Plus).dsk` (1 game) — `launch_args=RUN\&quot;FROGGER\&quot;\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe cpc6128p -cart "e:\NextLevel\systems\Amstrad CPC Plus\ENGPADOS.CPR" -flop1 "e:\NextLevel\systems\Amstrad CPC Plus\Frogger (CPC Plus).dsk" -autoboot_delay 2 -autoboot_command RUN\&quot;FROGGER\&quot;\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Amstrad CPC Plus"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe cpc6128p -cart "E:\NextLevel\systems\Amstrad CPC Plus\ENGPADOS.CPR" -flop1 "E:\NextLevel\systems\Amstrad CPC Plus\Frogger (CPC Plus).dsk" -rompath "E:\NextLevel\systems\Amstrad CPC Plus" -skip_gameinfo
     profile: MAME – Amstrad CPC Plus
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command run\&quot;frogger\&quot;\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 95. args — 1 system, 1 variant, 1 game

Systems: Camputers Lynx.

Example: Camputers Lynx · `Lynx Invaders (1983)(Camsoft)(GB).tap` (1 game) — `launch_args=MLOAD""INVADERS""\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe lynx48k -cass1 "e:\NextLevel\systems\Camputers Lynx\Lynx Invaders (1983)(Camsoft)(GB).tap" -autoboot_delay 2 -autoboot_command MLOADINVADERS\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Camputers Lynx"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe lynx48k -cass1 "E:\NextLevel\systems\Camputers Lynx\Lynx Invaders (1983)(Camsoft)(GB).tap" -rompath "E:\NextLevel\systems\Camputers Lynx" -skip_gameinfo
     profile: MAME – Camputers Lynx
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command mloadinvaders\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 96. bothError — 1 system, 1 variant, 1 game

Systems: Capcom System 256.

Example: Capcom System 256 · `tatsunoko.squashfs` (1 game)

```text
old: ERROR Error: Unknown system 'Capcom System 256'
new: ERROR NO_PROFILE
```

### 97. args — 1 system, 1 variant, 1 game

Systems: CCE MC-1000.

Example: CCE MC-1000 · `invasor.zip` (1 game) — `launch_args=TLOAD\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe mc1000 -cass "e:\NextLevel\systems\CCE MC-1000\invasor.zip" -autoboot_delay 2 -autoboot_command TLOAD\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\CCE MC-1000"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe mc1000 -cass "E:\NextLevel\systems\CCE MC-1000\invasor.zip" -rompath "E:\NextLevel\systems\CCE MC-1000" -skip_gameinfo
     profile: MAME – CCE MC-1000
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command tload\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 98. newError — 1 system, 1 variant, 1 game

Systems: Coleco Telstar.

Example: Coleco Telstar · `tennis.bat` (1 game)

```text
old: "e:\NextLevel\systems\Coleco Telstar\tennis.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 99. args — 1 system, 1 variant, 1 game

Systems: Commodore Amiga CD32.

Example: Commodore Amiga CD32 · `Turrican II - The Final Fight AGA.iso` (1 game) — `core=cd32_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\puae_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Commodore Amiga CD32.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Commodore Amiga CD32\Turrican II - The Final Fight AGA.cfg" "e:\roms\Commodore Amiga CD32\Turrican II - The Final Fight AGA.iso"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\cd32_libretro.dll "e:\roms\Commodore Amiga CD32\Turrican II - The Final Fight AGA.iso"
     profile: RetroArch – puae
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\puae_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing)
only new: {emulatorDir}\cores\cd32_libretro.dll
```

### 100. args — 1 system, 1 variant, 1 game

Systems: Exidy Sorcerer.

Example: Exidy Sorcerer · `Sorcerer Invaders.zip` (1 game) — `launch_args=LOG\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe sorcerer -cass1 "e:\NextLevel\systems\Exidy Sorcerer\Sorcerer Invaders.zip" -cart "e:\NextLevel\systems\Exidy Sorcerer\basicpac.zip" -autoboot_delay 2 -autoboot_command LOG\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Exidy Sorcerer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe sorcerer -cass1 "E:\NextLevel\systems\Exidy Sorcerer\Sorcerer Invaders.zip" -cart "E:\NextLevel\systems\Exidy Sorcerer\basicpac.zip" -rompath "E:\NextLevel\systems\Exidy Sorcerer" -skip_gameinfo
     profile: MAME – Exidy Sorcerer
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command log\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 101. args — 1 system, 1 variant, 1 game

Systems: Fujitsu FM-7.

Example: Fujitsu FM-7 · `Chackn Pop.zip` (1 game) — `launch_args=load\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe fm7 -flop1 "e:\NextLevel\systems\Fujitsu FM-7\Chackn Pop.zip" -autoboot_delay 2 -autoboot_command load\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Fujitsu FM-7"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe fm7 -flop1 "E:\NextLevel\systems\Fujitsu FM-7\Chackn Pop.zip" -rompath "E:\NextLevel\systems\Fujitsu FM-7" -skip_gameinfo
     profile: MAME – Fujitsu FM-7
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 2 -autoboot_command load\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 102. args — 1 system, 1 variant, 1 game

Systems: Memotech MTX.

Example: Memotech MTX · `pacman.zip` (1 game) — `launch_args=LOAD\&quot;\&quot;\n`

```text
old: e:/NextLevel/emulators/mame/mame.exe mtx512 -dump "e:\NextLevel\systems\Memotech MTX\pacman.zip" -autoboot_delay 4 -autoboot_command LOAD\&quot;\&quot;\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Memotech MTX"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe mtx512 -dump "E:\NextLevel\systems\Memotech MTX\pacman.zip" -rompath "E:\NextLevel\systems\Memotech MTX" -skip_gameinfo
     profile: MAME – Memotech MTX
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 4 -autoboot_command load\&quot;\&quot;\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 103. newError — 1 system, 1 variant, 1 game

Systems: Microsoft MSX Remakes.

Example: Microsoft MSX Remakes · `Goonies, The.bat` (1 game)

```text
old: "e:\NextLevel\systems\Microsoft MSX Remakes\Goonies, The.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 104. args — 1 system, 1 variant, 1 game

Systems: NEC PC-6001.

Example: NEC PC-6001 · `Asteroid (m2p4).cas` (1 game) — `launch_args=4`

```text
old: e:/NextLevel/emulators/mame/mame.exe pc6001 -%MEDIA% "e:\NextLevel\systems\NEC PC-6001\Asteroid (m2p4).cas" -autoboot_delay 4 -autoboot_command 4 -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\NEC PC-6001"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe pc6001 -cart1 "E:\NextLevel\systems\NEC PC-6001\Asteroid (m2p4).cas" -rompath "E:\NextLevel\systems\NEC PC-6001" -skip_gameinfo
     profile: MAME – NEC PC-6001
     cwd: e:\NextLevel\emulators\mame
only old: -%media% -autoboot_delay 4 -autoboot_command 4 -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart1
```

### 105. args — 1 system, 1 variant, 1 game

Systems: NEC PC-6001.

Example: NEC PC-6001 · `tutankhm.zip` (1 game) — `mame_media=cart1`

```text
old: e:/NextLevel/emulators/mame/mame.exe pc6001 -cart1 "e:\NextLevel\systems\NEC PC-6001\tutankhm.zip" -autoboot_delay 4 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\NEC PC-6001"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe pc6001 -cart1 "E:\NextLevel\systems\NEC PC-6001\tutankhm.zip" -rompath "E:\NextLevel\systems\NEC PC-6001" -skip_gameinfo
     profile: MAME – NEC PC-6001
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 4 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 106. args — 1 system, 1 variant, 1 game

Systems: Nintendo NES.

Example: Nintendo NES · `Duck Hunt (World).zip` (1 game) — `config=Nintendo NES Zapper`, `alt_core=fceumm_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\fceumm_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES Zapper.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES\Duck Hunt (World).cfg" "e:\NextLevel\systems\Nintendo NES\Duck Hunt (World).zip"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\nestopia_libretro.dll --appendconfig "e:\NextLevel\emulators\retroarch\config\Nintendo NES Zapper.cfg" "E:\NextLevel\systems\Nintendo NES\Duck Hunt (World).zip"
     profile: RetroArch – nestopia
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\fceumm_libretro.dll -c {emulatorDir}\config\{system}\{romName}.cfg
only new: {emulatorDir}\cores\nestopia_libretro.dll
```

### 107. args — 1 system, 1 variant, 1 game

Systems: Nintendo NES MSU-1.

Example: Nintendo NES MSU-1 · `The Legend of Zelda.wsquashfs` (1 game) — `squashfs_exe=The Legend of Zelda SNES.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1\The Legend of Zelda.cfg" "<squashfs mount>\The Legend of Zelda SNES.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo NES MSU-1\The Legend of Zelda.wsquashfs → The Legend of Zelda SNES.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo NES MSU-1\The Legend of Zelda.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\the legend of zelda snes.sfc"
only new: {rom}
```

### 108. args — 1 system, 1 variant, 1 game

Systems: Nintendo NES MSU-1.

Example: Nintendo NES MSU-1 · `Mega Man II SNES.wsquashfs` (1 game) — `squashfs_exe=Mega Man II MSU1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1\Mega Man II SNES.cfg" "<squashfs mount>\Mega Man II MSU1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo NES MSU-1\Mega Man II SNES.wsquashfs → Mega Man II MSU1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo NES MSU-1\Mega Man II SNES.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mega man ii msu1.sfc"
only new: {rom}
```

### 109. args — 1 system, 1 variant, 1 game

Systems: Nintendo NES MSU-1.

Example: Nintendo NES MSU-1 · `Mega Man IV SNES.wsquashfs` (1 game) — `squashfs_exe=mmiv_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1\Mega Man IV SNES.cfg" "<squashfs mount>\mmiv_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo NES MSU-1\Mega Man IV SNES.wsquashfs → mmiv_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo NES MSU-1\Mega Man IV SNES.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mmiv_msu1.sfc"
only new: {rom}
```

### 110. args — 1 system, 1 variant, 1 game

Systems: Nintendo NES MSU-1.

Example: Nintendo NES MSU-1 · `Zelda II - The Adventure of Link.wsquashfs` (1 game) — `squashfs_exe=Zelda II - The Adventure of Link SNES.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo NES MSU-1\Zelda II - The Adventure of Link.cfg" "<squashfs mount>\Zelda II - The Adventure of Link SNES.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo NES MSU-1\Zelda II - The Adventure of Link.wsquashfs → Zelda II - The Adventure of Link SNES.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo NES MSU-1\Zelda II - The Adventure of Link.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\zelda ii - the adventure of link snes.sfc"
only new: {rom}
```

### 111. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `ActRaiser (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=ActRaiser_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\ActRaiser (USA) (MSU1).cfg" "<squashfs mount>\ActRaiser_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\ActRaiser (USA) (MSU1).wsquashfs → ActRaiser_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\ActRaiser (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\actraiser_(usa)_(msu1).sfc"
only new: {rom}
```

### 112. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `ActRaiser 2 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=ActRaiser_2_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\ActRaiser 2 (USA) (MSU1).cfg" "<squashfs mount>\ActRaiser_2_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\ActRaiser 2 (USA) (MSU1).wsquashfs → ActRaiser_2_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\ActRaiser 2 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\actraiser_2_(usa)_(msu1).sfc"
only new: {rom}
```

### 113. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Aladdin (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Aladdin_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Aladdin (USA) (MSU1).cfg" "<squashfs mount>\Aladdin_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Aladdin (USA) (MSU1).wsquashfs → Aladdin_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Aladdin (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\aladdin_(usa)_(msu1).sfc"
only new: {rom}
```

### 114. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Alien 3 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=alien3_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Alien 3 (US) (MSU-1).cfg" "<squashfs mount>\alien3_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Alien 3 (US) (MSU-1).wsquashfs → alien3_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Alien 3 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\alien3_msu1.sfc"
only new: {rom}
```

### 115. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Alien 3 Assembly Cut MSU-1.wsquashfs` (1 game) — `squashfs_exe=Alien 3 (MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Alien 3 Assembly Cut MSU-1.cfg" "<squashfs mount>\Alien 3 (MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Alien 3 Assembly Cut MSU-1.wsquashfs → Alien 3 (MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Alien 3 Assembly Cut MSU-1.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\alien 3 (msu1).sfc"
only new: {rom}
```

### 116. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Area 88 (USA) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Area 88 (USA) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Area 88 (USA) (MSU1) [T-En].cfg" "<squashfs mount>\Area 88 (USA) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Area 88 (USA) (MSU1) [T-En].wsquashfs → Area 88 (USA) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Area 88 (USA) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\area 88 (usa) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 117. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Assault Suits Valken (Japan) (MSU1) [T-En by Aeon Genesis v1.00] [n].wsquashfs` (1 game) — `squashfs_exe=Assault_Suits_Valken_(Japan)_(MSU1)_[T-En].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Assault Suits Valken (Japan) (MSU1) [T-En by Aeon Genesis v1.00] [n].cfg" "<squashfs mount>\Assault_Suits_Valken_(Japan)_(MSU1)_[T-En].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Assault Suits Valken (Japan) (MSU1) [T-En by Aeon Genesis v1.00] [n].wsquashfs → Assault_Suits_Valken_(Japan)_(MSU1)_[T-En].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Assault Suits Valken (Japan) (MSU1) [T-En by Aeon Genesis v1.00] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\assault_suits_valken_(japan)_(msu1)_[t-en].sfc"
only new: {rom}
```

### 118. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Axelay (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Axelay_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Axelay (USA) (MSU1).cfg" "<squashfs mount>\Axelay_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Axelay (USA) (MSU1).wsquashfs → Axelay_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Axelay (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\axelay_(usa)_(msu1).sfc"
only new: {rom}
```

### 119. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Batman Returns (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Batman_Returns_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Batman Returns (USA) (MSU1).cfg" "<squashfs mount>\Batman_Returns_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Batman Returns (USA) (MSU1).wsquashfs → Batman_Returns_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Batman Returns (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\batman_returns_(usa)_(msu1).sfc"
only new: {rom}
```

### 120. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Battletoads-Double Dragon (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Battletoads-Double_Dragon_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Battletoads-Double Dragon (USA) (MSU1).cfg" "<squashfs mount>\Battletoads-Double_Dragon_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Battletoads-Double Dragon (USA) (MSU1).wsquashfs → Battletoads-Double_Dragon_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Battletoads-Double Dragon (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\battletoads-double_dragon_(usa)_(msu1).sfc"
only new: {rom}
```

### 121. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Battletoads in Battlemaniacs (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Battletoads_in_Battlemaniacs_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Battletoads in Battlemaniacs (USA) (MSU1).cfg" "<squashfs mount>\Battletoads_in_Battlemaniacs_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Battletoads in Battlemaniacs (USA) (MSU1).wsquashfs → Battletoads_in_Battlemaniacs_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Battletoads in Battlemaniacs (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\battletoads_in_battlemaniacs_(usa)_(msu1).sfc"
only new: {rom}
```

### 122. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Beavis And Butt-Head (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=bb_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Beavis And Butt-Head (US) (MSU-1).cfg" "<squashfs mount>\bb_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Beavis And Butt-Head (US) (MSU-1).wsquashfs → bb_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Beavis And Butt-Head (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bb_msu1.sfc"
only new: {rom}
```

### 123. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Bram Stoker's Dracula (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Bram_Stoker's_Dracula_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Bram Stoker's Dracula (USA) (MSU1).cfg" "<squashfs mount>\Bram_Stoker's_Dracula_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Bram Stoker's Dracula (USA) (MSU1).wsquashfs → Bram_Stoker's_Dracula_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Bram Stoker's Dracula (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bram_stoker's_dracula_(usa)_(msu1).sfc"
only new: {rom}
```

### 124. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Breath Of Fire II (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=bof2_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Breath Of Fire II (USA) (MSU1).cfg" "<squashfs mount>\bof2_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Breath Of Fire II (USA) (MSU1).wsquashfs → bof2_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Breath Of Fire II (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bof2_msu.sfc"
only new: {rom}
```

### 125. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS F-Zero Grand Prix 2 (Japan) (MSU1).wsquashfs` (1 game) — `squashfs_exe=BS_F-Zero_Grand_Prix_2_(Japan)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS F-Zero Grand Prix 2 (Japan) (MSU1).cfg" "<squashfs mount>\BS_F-Zero_Grand_Prix_2_(Japan)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS F-Zero Grand Prix 2 (Japan) (MSU1).wsquashfs → BS_F-Zero_Grand_Prix_2_(Japan)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS F-Zero Grand Prix 2 (Japan) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_f-zero_grand_prix_2_(japan)_(msu1).sfc"
only new: {rom}
```

### 126. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En].wsquashfs → BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda, The - Fourth Quest (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs legend of zelda, the - fourth quest (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 127. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda Map 1, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_Map_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda Map 1, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_Map_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda Map 1, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_Map_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda Map 1, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_map_1,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 128. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda Map 2, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_Map_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda Map 2, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_Map_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda Map 2, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_Map_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda Map 2, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_map_2,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 129. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda - Ancient Stone Tablets - Chapter 1, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 1, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 1, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_1,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 1, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_-_ancient_stone_tablets_-_chapter_1,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 130. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda - Ancient Stone Tablets - Chapter 2, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 2, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 2, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_2,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 2, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_-_ancient_stone_tablets_-_chapter_2,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 131. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda - Ancient Stone Tablets - Chapter 3, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_3,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 3, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_3,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 3, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_3,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 3, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_-_ancient_stone_tablets_-_chapter_3,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 132. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda - Ancient Stone Tablets - Chapter 4, The (Japan) (MSU1) [T-En] [n].wsquashfs` (1 game) — `squashfs_exe=BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_4,_The_(Japan)_(MSU1)_[T-En]_[n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 4, The (Japan) (MSU1) [T-En] [n].cfg" "<squashfs mount>\BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_4,_The_(Japan)_(MSU1)_[T-En]_[n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 4, The (Japan) (MSU1) [T-En] [n].wsquashfs → BS_Legend_of_Zelda_-_Ancient_Stone_Tablets_-_Chapter_4,_The_(Japan)_(MSU1)_[T-En]_[n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda - Ancient Stone Tablets - Chapter 4, The (Japan) (MSU1) [T-En] [n].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs_legend_of_zelda_-_ancient_stone_tablets_-_chapter_4,_the_(japan)_(msu1)_[t-en]_[n].sfc"
only new: {rom}
```

### 133. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En].wsquashfs → BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Legend of Zelda, The - Third Quest (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs legend of zelda, the - third quest (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 134. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En].wsquashfs → BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Radical Dreamers - Le Tresor Interdit (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs radical dreamers - le tresor interdit (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 135. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `BS Super Mario World (USA) (Demo) (MSU1).wsquashfs` (1 game) — `squashfs_exe=BS Super Mario World (USA) (Demo) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\BS Super Mario World (USA) (Demo) (MSU1).cfg" "<squashfs mount>\BS Super Mario World (USA) (Demo) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\BS Super Mario World (USA) (Demo) (MSU1).wsquashfs → BS Super Mario World (USA) (Demo) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\BS Super Mario World (USA) (Demo) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bs super mario world (usa) (demo) (msu1) [n].sfc"
only new: {rom}
```

### 136. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Captain America and the Avengers (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Captain_America_and_the_Avengers_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Captain America and the Avengers (USA) (MSU1).cfg" "<squashfs mount>\Captain_America_and_the_Avengers_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Captain America and the Avengers (USA) (MSU1).wsquashfs → Captain_America_and_the_Avengers_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Captain America and the Avengers (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\captain_america_and_the_avengers_(usa)_(msu1).sfc"
only new: {rom}
```

### 137. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Captain Commando (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Captain_Commando_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Captain Commando (USA) (MSU1).cfg" "<squashfs mount>\Captain_Commando_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Captain Commando (USA) (MSU1).wsquashfs → Captain_Commando_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Captain Commando (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\captain_commando_(usa)_(msu1).sfc"
only new: {rom}
```

### 138. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Castlevania - Dracula X (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Castlevania_-_Dracula_X_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Castlevania - Dracula X (USA) (MSU1).cfg" "<squashfs mount>\Castlevania_-_Dracula_X_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Castlevania - Dracula X (USA) (MSU1).wsquashfs → Castlevania_-_Dracula_X_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Castlevania - Dracula X (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\castlevania_-_dracula_x_(usa)_(msu1).sfc"
only new: {rom}
```

### 139. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Choujikuu Yousai Macross - Scrambled Valkyrie (Japan) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Choujikuu_Yousai_Macross_-_Scrambled_Valkyrie_(Japan)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Choujikuu Yousai Macross - Scrambled Valkyrie (Japan) (MSU1).cfg" "<squashfs mount>\Choujikuu_Yousai_Macross_-_Scrambled_Valkyrie_(Japan)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Choujikuu Yousai Macross - Scrambled Valkyrie (Japan) (MSU1).wsquashfs → Choujikuu_Yousai_Macross_-_Scrambled_Valkyrie_(Japan)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Choujikuu Yousai Macross - Scrambled Valkyrie (Japan) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\choujikuu_yousai_macross_-_scrambled_valkyrie_(japan)_(msu1).sfc"
only new: {rom}
```

### 140. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Chrono Trigger (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Chrono_Trigger_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Chrono Trigger (USA) (MSU1).cfg" "<squashfs mount>\Chrono_Trigger_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Chrono Trigger (USA) (MSU1).wsquashfs → Chrono_Trigger_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Chrono Trigger (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\chrono_trigger_(usa)_(msu1).sfc"
only new: {rom}
```

### 141. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Chrono Trigger - Prophets Guile (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Chrono_Trigger_Prophets_Guile_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Chrono Trigger - Prophets Guile (USA) (MSU1).cfg" "<squashfs mount>\Chrono_Trigger_Prophets_Guile_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Chrono Trigger - Prophets Guile (USA) (MSU1).wsquashfs → Chrono_Trigger_Prophets_Guile_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Chrono Trigger - Prophets Guile (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\chrono_trigger_prophets_guile_(usa)_(msu1).sfc"
only new: {rom}
```

### 142. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Chrono Trigger (MSU1) (Audio Orchestral).wsquashfs` (1 game) — `squashfs_exe=Chrono_Trigger_orchiestra_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Chrono Trigger (MSU1) (Audio Orchestral).cfg" "<squashfs mount>\Chrono_Trigger_orchiestra_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Chrono Trigger (MSU1) (Audio Orchestral).wsquashfs → Chrono_Trigger_orchiestra_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Chrono Trigger (MSU1) (Audio Orchestral).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\chrono_trigger_orchiestra_(usa)_(msu1).sfc"
only new: {rom}
```

### 143. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Conker's High Rule Tail (Unl) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Conker's_High_Rule_Tail_(Unl)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Conker's High Rule Tail (Unl) (MSU1).cfg" "<squashfs mount>\Conker's_High_Rule_Tail_(Unl)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Conker's High Rule Tail (Unl) (MSU1).wsquashfs → Conker's_High_Rule_Tail_(Unl)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Conker's High Rule Tail (Unl) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\conker's_high_rule_tail_(unl)_(msu1).sfc"
only new: {rom}
```

### 144. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Contra III - The Alien Wars (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Contra_III_-_The_Alien_Wars_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Contra III - The Alien Wars (USA) (MSU1).cfg" "<squashfs mount>\Contra_III_-_The_Alien_Wars_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Contra III - The Alien Wars (USA) (MSU1).wsquashfs → Contra_III_-_The_Alien_Wars_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Contra III - The Alien Wars (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\contra_iii_-_the_alien_wars_(usa)_(msu1).sfc"
only new: {rom}
```

### 145. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Robot Wars 4 (MSU1).wsquashfs` (1 game) — `squashfs_exe=SRW4_MSU1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Robot Wars 4 (MSU1).cfg" "<squashfs mount>\SRW4_MSU1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Robot Wars 4 (MSU1).wsquashfs → SRW4_MSU1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Robot Wars 4 (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\srw4_msu1.sfc"
only new: {rom}
```

### 146. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Darius Twin (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Darius_Twin_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Darius Twin (USA) (MSU1).cfg" "<squashfs mount>\Darius_Twin_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Darius Twin (USA) (MSU1).wsquashfs → Darius_Twin_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Darius Twin (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\darius_twin_(usa)_(msu1).sfc"
only new: {rom}
```

### 147. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Death and Return of Superman, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Death_and_Return_of_Superman,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Death and Return of Superman, The (USA) (MSU1).cfg" "<squashfs mount>\Death_and_Return_of_Superman,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Death and Return of Superman, The (USA) (MSU1).wsquashfs → Death_and_Return_of_Superman,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Death and Return of Superman, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\death_and_return_of_superman,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 148. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Demon's Crest (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Demon's_Crest_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Demon's Crest (USA) (MSU1).cfg" "<squashfs mount>\Demon's_Crest_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Demon's Crest (USA) (MSU1).wsquashfs → Demon's_Crest_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Demon's Crest (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\demon's_crest_(usa)_(msu1).sfc"
only new: {rom}
```

### 149. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Donkey Kong Country (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Donkey_Kong_Country_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Donkey Kong Country (USA) (MSU1).cfg" "<squashfs mount>\Donkey_Kong_Country_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Donkey Kong Country (USA) (MSU1).wsquashfs → Donkey_Kong_Country_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Donkey Kong Country (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\donkey_kong_country_(usa)_(msu1).sfc"
only new: {rom}
```

### 150. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Donkey Kong Country 2 - Diddy's Kong Quest (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Donkey_Kong_Country_2_-_Diddy's_Kong_Quest_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Donkey Kong Country 2 - Diddy's Kong Quest (USA) (MSU1).cfg" "<squashfs mount>\Donkey_Kong_Country_2_-_Diddy's_Kong_Quest_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Donkey Kong Country 2 - Diddy's Kong Quest (USA) (MSU1).wsquashfs → Donkey_Kong_Country_2_-_Diddy's_Kong_Quest_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Donkey Kong Country 2 - Diddy's Kong Quest (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\donkey_kong_country_2_-_diddy's_kong_quest_(usa)_(msu1).sfc"
only new: {rom}
```

### 151. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Donkey Kong Country 3 - Dixie Kong's Double Trouble! (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Donkey_Kong_Country_3_-_Dixie_Kong's_Double_Trouble!_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Donkey Kong Country 3 - Dixie Kong's Double Trouble! (USA) (MSU1).cfg" "<squashfs mount>\Donkey_Kong_Country_3_-_Dixie_Kong's_Double_Trouble!_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Donkey Kong Country 3 - Dixie Kong's Double Trouble! (USA) (MSU1).wsquashfs → Donkey_Kong_Country_3_-_Dixie_Kong's_Double_Trouble!_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Donkey Kong Country 3 - Dixie Kong's Double Trouble! (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\donkey_kong_country_3_-_dixie_kong's_double_trouble!_(usa)_(msu1).sfc"
only new: {rom}
```

### 152. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Doom (USA) (MSU1) [Hack by Conn & Cubear v2].wsquashfs` (1 game) — `squashfs_exe=Doom (USA) (MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Doom (USA) (MSU1) [Hack by Conn & Cubear v2].cfg" "<squashfs mount>\Doom (USA) (MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Doom (USA) (MSU1) [Hack by Conn & Cubear v2].wsquashfs → Doom (USA) (MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Doom (USA) (MSU1) [Hack by Conn & Cubear v2].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\doom (usa) (msu1).sfc"
only new: {rom}
```

### 153. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Dragon Quest III (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Dragon Quest III (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Dragon Quest III (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Dragon Quest III (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Dragon Quest III (Japan) (MSU1) [T-En].wsquashfs → Dragon Quest III (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Dragon Quest III (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\dragon quest iii (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 154. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Dragon Quest V (MSU1).wsquashfs` (1 game) — `squashfs_exe=dq5_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Dragon Quest V (MSU1).cfg" "<squashfs mount>\dq5_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Dragon Quest V (MSU1).wsquashfs → dq5_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Dragon Quest V (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\dq5_msu.sfc"
only new: {rom}
```

### 155. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `E.V.O. - Search for Eden (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=E.V.O._-_Search_for_Eden_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\E.V.O. - Search for Eden (USA) (MSU1).cfg" "<squashfs mount>\E.V.O._-_Search_for_Eden_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\E.V.O. - Search for Eden (USA) (MSU1).wsquashfs → E.V.O._-_Search_for_Eden_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\E.V.O. - Search for Eden (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\e.v.o._-_search_for_eden_(usa)_(msu1).sfc"
only new: {rom}
```

### 156. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Earthworm Jim (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Earthworm_Jim_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Earthworm Jim (USA) (MSU1).cfg" "<squashfs mount>\Earthworm_Jim_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Earthworm Jim (USA) (MSU1).wsquashfs → Earthworm_Jim_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Earthworm Jim (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\earthworm_jim_(usa)_(msu1).sfc"
only new: {rom}
```

### 157. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Earthworm Jim 2 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Earthworm_Jim_2_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Earthworm Jim 2 (USA) (MSU1).cfg" "<squashfs mount>\Earthworm_Jim_2_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Earthworm Jim 2 (USA) (MSU1).wsquashfs → Earthworm_Jim_2_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Earthworm Jim 2 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\earthworm_jim_2_(usa)_(msu1).sfc"
only new: {rom}
```

### 158. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Fatal Fury Special (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ffspec_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Fatal Fury Special (US) (MSU-1).cfg" "<squashfs mount>\ffspec_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Fatal Fury Special (US) (MSU-1).wsquashfs → ffspec_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Fatal Fury Special (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ffspec_msu1.sfc"
only new: {rom}
```

### 159. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fantasy II (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ff2j_msu1.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).cfg" "<squashfs mount>\ff2j_msu1.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).wsquashfs → ff2j_msu1.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ff2j_msu1.smc"
only new: {rom}
```

### 160. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fantasy V (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ff5.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).cfg" "<squashfs mount>\ff5.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).wsquashfs → ff5.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ff5.smc"
only new: {rom}
```

### 161. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Fighter's History (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Fighter's_History_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Fighter's History (USA) (MSU1).cfg" "<squashfs mount>\Fighter's_History_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Fighter's History (USA) (MSU1).wsquashfs → Fighter's_History_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Fighter's History (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\fighter's_history_(usa)_(msu1).sfc"
only new: {rom}
```

### 162. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fantasy II (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ff2j_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).cfg" "<squashfs mount>\ff2j_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).wsquashfs → ff2j_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fantasy II (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ff2j_msu1.sfc"
only new: {rom}
```

### 163. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fantasy V (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ff5.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).cfg" "<squashfs mount>\ff5.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).wsquashfs → ff5.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fantasy V (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ff5.sfc"
only new: {rom}
```

### 164. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fantasy VI (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Final_Fantasy_VI_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fantasy VI (USA) (MSU1).cfg" "<squashfs mount>\Final_Fantasy_VI_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fantasy VI (USA) (MSU1).wsquashfs → Final_Fantasy_VI_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fantasy VI (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\final_fantasy_vi_(usa)_(msu1).sfc"
only new: {rom}
```

### 165. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fight (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Final_Fight_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fight (USA) (MSU1).cfg" "<squashfs mount>\Final_Fight_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fight (USA) (MSU1).wsquashfs → Final_Fight_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fight (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\final_fight_(usa)_(msu1).sfc"
only new: {rom}
```

### 166. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fight 2 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Final_Fight_2_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fight 2 (USA) (MSU1).cfg" "<squashfs mount>\Final_Fight_2_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fight 2 (USA) (MSU1).wsquashfs → Final_Fight_2_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fight 2 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\final_fight_2_(usa)_(msu1).sfc"
only new: {rom}
```

### 167. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Final Fight 3 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ff3_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Final Fight 3 (US) (MSU-1).cfg" "<squashfs mount>\ff3_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Final Fight 3 (US) (MSU-1).wsquashfs → ff3_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Final Fight 3 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ff3_msu1.sfc"
only new: {rom}
```

### 168. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Fire Emblem IV Genealogy of the Holy War (MSU1).wsquashfs` (1 game) — `squashfs_exe=fe4-msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Fire Emblem IV Genealogy of the Holy War (MSU1).cfg" "<squashfs mount>\fe4-msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Fire Emblem IV Genealogy of the Holy War (MSU1).wsquashfs → fe4-msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Fire Emblem IV Genealogy of the Holy War (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\fe4-msu.sfc"
only new: {rom}
```

### 169. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Flashback (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Flashback_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Flashback (USA) (MSU1).cfg" "<squashfs mount>\Flashback_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Flashback (USA) (MSU1).wsquashfs → Flashback_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Flashback (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\flashback_(usa)_(msu1).sfc"
only new: {rom}
```

### 170. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `F-Zero Final (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=F-Zero Final (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\F-Zero Final (USA) (MSU1).cfg" "<squashfs mount>\F-Zero Final (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\F-Zero Final (USA) (MSU1).wsquashfs → F-Zero Final (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\F-Zero Final (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\f-zero final (usa) (msu1) [n].sfc"
only new: {rom}
```

### 171. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En].cfg" "<squashfs mount>\Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En].wsquashfs → Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Go for it! Goemon - The Rescue of Princess Yuki (Japan) (Rev 2) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\go for it! goemon - the rescue of princess yuki (japan) (rev 2) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 172. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Gradius III (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Gradius_III_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Gradius III (USA) (MSU1).cfg" "<squashfs mount>\Gradius_III_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Gradius III (USA) (MSU1).wsquashfs → Gradius_III_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Gradius III (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\gradius_iii_(usa)_(msu1).sfc"
only new: {rom}
```

### 173. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Gradius III (Midi Power X68000) (MSU1).wsquashfs` (1 game) — `squashfs_exe=g3-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Gradius III (Midi Power X68000) (MSU1).cfg" "<squashfs mount>\g3-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Gradius III (Midi Power X68000) (MSU1).wsquashfs → g3-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Gradius III (Midi Power X68000) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\g3-msu1.sfc"
only new: {rom}
```

### 174. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Hagane The Final Conflict (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=htfc-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Hagane The Final Conflict (US) (MSU-1).cfg" "<squashfs mount>\htfc-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Hagane The Final Conflict (US) (MSU-1).wsquashfs → htfc-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Hagane The Final Conflict (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\htfc-msu1.sfc"
only new: {rom}
```

### 175. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En].cfg" "<squashfs mount>\Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En].wsquashfs → Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Heartthrob Memorial - Under the Tree of Legends (Japan) (Rev 1) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\heartthrob memorial - under the tree of legends (japan) (rev 1) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 176. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Home Alone (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Home_Alone_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Home Alone (USA) (MSU1).cfg" "<squashfs mount>\Home_Alone_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Home Alone (USA) (MSU1).wsquashfs → Home_Alone_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Home Alone (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\home_alone_(usa)_(msu1).sfc"
only new: {rom}
```

### 177. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Hong Kong 97 (Unl) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Hong_Kong_97_(Unl)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Hong Kong 97 (Unl) (MSU1).cfg" "<squashfs mount>\Hong_Kong_97_(Unl)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Hong Kong 97 (Unl) (MSU1).wsquashfs → Hong_Kong_97_(Unl)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Hong Kong 97 (Unl) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\hong_kong_97_(unl)_(msu1).sfc"
only new: {rom}
```

### 178. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Hook (EU) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=hook_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Hook (EU) (MSU-1).cfg" "<squashfs mount>\hook_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Hook (EU) (MSU-1).wsquashfs → hook_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Hook (EU) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\hook_msu1.sfc"
only new: {rom}
```

### 179. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Hook (EU) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=hook_msu1.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Hook (EU) (MSU-1).cfg" "<squashfs mount>\hook_msu1.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Hook (EU) (MSU-1).wsquashfs → hook_msu1.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Hook (EU) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\hook_msu1.smc"
only new: {rom}
```

### 180. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Hyper Street Kart - PittStone Mixes-MSU1.wsquashfs` (1 game) — `squashfs_exe=hsk-msu1.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Hyper Street Kart - PittStone Mixes-MSU1.cfg" "<squashfs mount>\hsk-msu1.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Hyper Street Kart - PittStone Mixes-MSU1.wsquashfs → hsk-msu1.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Hyper Street Kart - PittStone Mixes-MSU1.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\hsk-msu1.smc"
only new: {rom}
```

### 181. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Illusion of Gaia (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=iog_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Illusion of Gaia (USA) (MSU1).cfg" "<squashfs mount>\iog_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Illusion of Gaia (USA) (MSU1).wsquashfs → iog_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Illusion of Gaia (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\iog_msu1.sfc"
only new: {rom}
```

### 182. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Indiana Jones' Greatest Adventures (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Indiana_Jones'_Greatest_Adventures_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Indiana Jones' Greatest Adventures (USA) (MSU1).cfg" "<squashfs mount>\Indiana_Jones'_Greatest_Adventures_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Indiana Jones' Greatest Adventures (USA) (MSU1).wsquashfs → Indiana_Jones'_Greatest_Adventures_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Indiana Jones' Greatest Adventures (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\indiana_jones'_greatest_adventures_(usa)_(msu1).sfc"
only new: {rom}
```

### 183. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `International Superstar Soccer Deluxe (PSX OST) MSU-1.wsquashfs` (1 game) — `squashfs_exe=issd_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\International Superstar Soccer Deluxe (PSX OST) MSU-1.cfg" "<squashfs mount>\issd_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\International Superstar Soccer Deluxe (PSX OST) MSU-1.wsquashfs → issd_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\International Superstar Soccer Deluxe (PSX OST) MSU-1.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\issd_msu.sfc"
only new: {rom}
```

### 184. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Chatting Parodius Live! (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Chatting Parodius Live! (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Chatting Parodius Live! (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Chatting Parodius Live! (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Chatting Parodius Live! (Japan) (MSU1) [T-En].wsquashfs → Chatting Parodius Live! (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Chatting Parodius Live! (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\chatting parodius live! (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 185. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Joe and Mac (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=jm_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Joe and Mac (US) (MSU-1).cfg" "<squashfs mount>\jm_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Joe and Mac (US) (MSU-1).wsquashfs → jm_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Joe and Mac (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\jm_msu1.sfc"
only new: {rom}
```

### 186. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Jurassic Park (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Jurassic_Park_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Jurassic Park (USA) (MSU1).cfg" "<squashfs mount>\Jurassic_Park_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Jurassic Park (USA) (MSU1).wsquashfs → Jurassic_Park_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Jurassic Park (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\jurassic_park_(usa)_(msu1).sfc"
only new: {rom}
```

### 187. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Justice League Task Force (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=jltf_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Justice League Task Force (US) (MSU-1).cfg" "<squashfs mount>\jltf_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Justice League Task Force (US) (MSU-1).wsquashfs → jltf_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Justice League Task Force (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\jltf_msu1.sfc"
only new: {rom}
```

### 188. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Killer Instinct (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Killer_Instinct_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Killer Instinct (USA) (MSU1).cfg" "<squashfs mount>\Killer_Instinct_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Killer Instinct (USA) (MSU1).wsquashfs → Killer_Instinct_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Killer Instinct (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\killer_instinct_(usa)_(msu1).sfc"
only new: {rom}
```

### 189. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Kirby Super Star (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=kss_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Kirby Super Star (US) (MSU-1).cfg" "<squashfs mount>\kss_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Kirby Super Star (US) (MSU-1).wsquashfs → kss_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Kirby Super Star (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\kss_msu1.sfc"
only new: {rom}
```

### 190. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Kirby's Dream Land 3 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Kirby's_Dream_Land_3_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Kirby's Dream Land 3 (USA) (MSU1).cfg" "<squashfs mount>\Kirby's_Dream_Land_3_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Kirby's Dream Land 3 (USA) (MSU1).wsquashfs → Kirby's_Dream_Land_3_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Kirby's Dream Land 3 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\kirby's_dream_land_3_(usa)_(msu1).sfc"
only new: {rom}
```

### 191. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Knights Of The Round (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=kotr-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Knights Of The Round (US) (MSU-1).cfg" "<squashfs mount>\kotr-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Knights Of The Round (US) (MSU-1).wsquashfs → kotr-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Knights Of The Round (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\kotr-msu1.sfc"
only new: {rom}
```

### 192. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of the Mystical Ninja, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend_of_the_Mystical_Ninja,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of the Mystical Ninja, The (USA) (MSU1).cfg" "<squashfs mount>\Legend_of_the_Mystical_Ninja,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of the Mystical Ninja, The (USA) (MSU1).wsquashfs → Legend_of_the_Mystical_Ninja,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of the Mystical Ninja, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend_of_the_mystical_ninja,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 193. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of Zelda, The - A Link to the Past DX (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend_of_Zelda,_The_-_A_Link_to_the_Past_DX_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of Zelda, The - A Link to the Past DX (USA) (MSU1).cfg" "<squashfs mount>\Legend_of_Zelda,_The_-_A_Link_to_the_Past_DX_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of Zelda, The - A Link to the Past DX (USA) (MSU1).wsquashfs → Legend_of_Zelda,_The_-_A_Link_to_the_Past_DX_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of Zelda, The - A Link to the Past DX (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend_of_zelda,_the_-_a_link_to_the_past_dx_(usa)_(msu1).sfc"
only new: {rom}
```

### 194. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Zelda Link to the Past Randomizer (MSU-1 Alternate Zelda Soundtrack).wsquashfs` (1 game) — `squashfs_exe=alttp_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Zelda Link to the Past Randomizer (MSU-1 Alternate Zelda Soundtrack).cfg" "<squashfs mount>\alttp_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Zelda Link to the Past Randomizer (MSU-1 Alternate Zelda Soundtrack).wsquashfs → alttp_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Zelda Link to the Past Randomizer (MSU-1 Alternate Zelda Soundtrack).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\alttp_msu.sfc"
only new: {rom}
```

### 195. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1).cfg" "<squashfs mount>\Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1).wsquashfs → Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of Zelda, The - AVGN vs Ganon (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend of zelda, the - avgn vs ganon (usa) (msu1) [n].sfc"
only new: {rom}
```

### 196. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1).cfg" "<squashfs mount>\Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1).wsquashfs → Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of Zelda, The - Goddess of Wisdom (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend of zelda, the - goddess of wisdom (usa) (msu1) [n].sfc"
only new: {rom}
```

### 197. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of Zelda, The - Lyra Islands (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend of Zelda, The - Lyra Islands (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of Zelda, The - Lyra Islands (USA) (MSU1).cfg" "<squashfs mount>\Legend of Zelda, The - Lyra Islands (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of Zelda, The - Lyra Islands (USA) (MSU1).wsquashfs → Legend of Zelda, The - Lyra Islands (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of Zelda, The - Lyra Islands (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend of zelda, the - lyra islands (usa) (msu1) [n].sfc"
only new: {rom}
```

### 198. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Legend of Zelda, The - Parallel Worlds (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Legend_of_Zelda,_The_-_Parallel_Worlds_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Legend of Zelda, The - Parallel Worlds (USA) (MSU1).cfg" "<squashfs mount>\Legend_of_Zelda,_The_-_Parallel_Worlds_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Legend of Zelda, The - Parallel Worlds (USA) (MSU1).wsquashfs → Legend_of_Zelda,_The_-_Parallel_Worlds_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Legend of Zelda, The - Parallel Worlds (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\legend_of_zelda,_the_-_parallel_worlds_(usa)_(msu1).sfc"
only new: {rom}
```

### 199. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Lemmings (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Lemmings_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Lemmings (USA) (MSU1).cfg" "<squashfs mount>\Lemmings_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Lemmings (USA) (MSU1).wsquashfs → Lemmings_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Lemmings (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\lemmings_(usa)_(msu1).sfc"
only new: {rom}
```

### 200. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Lion King, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Lion_King,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Lion King, The (USA) (MSU1).cfg" "<squashfs mount>\Lion_King,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Lion King, The (USA) (MSU1).wsquashfs → Lion_King,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Lion King, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\lion_king,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 201. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Live A Live (Japan) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Live A Live (Japan) (MSU1) [T-En].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Live A Live (Japan) (MSU1).cfg" "<squashfs mount>\Live A Live (Japan) (MSU1) [T-En].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Live A Live (Japan) (MSU1).wsquashfs → Live A Live (Japan) (MSU1) [T-En].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Live A Live (Japan) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\live a live (japan) (msu1) [t-en].sfc"
only new: {rom}
```

### 202. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Cotton 100% (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=c100_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Cotton 100% (J) (MSU-1).cfg" "<squashfs mount>\c100_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Cotton 100% (J) (MSU-1).wsquashfs → c100_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Cotton 100% (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\c100_msu.sfc"
only new: {rom}
```

### 203. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Magic Sword (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=msword-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Magic Sword (US) (MSU-1).cfg" "<squashfs mount>\msword-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Magic Sword (US) (MSU-1).wsquashfs → msword-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Magic Sword (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\msword-msu1.sfc"
only new: {rom}
```

### 204. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Magical Quest Starring Mickey Mouse, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Magical_Quest_Starring_Mickey_Mouse,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Magical Quest Starring Mickey Mouse, The (USA) (MSU1).cfg" "<squashfs mount>\Magical_Quest_Starring_Mickey_Mouse,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Magical Quest Starring Mickey Mouse, The (USA) (MSU1).wsquashfs → Magical_Quest_Starring_Mickey_Mouse,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Magical Quest Starring Mickey Mouse, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\magical_quest_starring_mickey_mouse,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 205. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mask, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mask,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mask, The (USA) (MSU1).cfg" "<squashfs mount>\Mask,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mask, The (USA) (MSU1).wsquashfs → Mask,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mask, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mask,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 206. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Maui Mallard in Cold Shadow (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Maui_Mallard_in_Cold_Shadow_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Maui Mallard in Cold Shadow (USA) (MSU1).cfg" "<squashfs mount>\Maui_Mallard_in_Cold_Shadow_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Maui Mallard in Cold Shadow (USA) (MSU1).wsquashfs → Maui_Mallard_in_Cold_Shadow_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Maui Mallard in Cold Shadow (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\maui_mallard_in_cold_shadow_(usa)_(msu1).sfc"
only new: {rom}
```

### 207. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man 7 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mega_Man_7_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man 7 (USA) (MSU1).cfg" "<squashfs mount>\Mega_Man_7_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man 7 (USA) (MSU1).wsquashfs → Mega_Man_7_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man 7 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mega_man_7_(usa)_(msu1).sfc"
only new: {rom}
```

### 208. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man X (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mega_Man_X_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man X (USA) (MSU1).cfg" "<squashfs mount>\Mega_Man_X_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man X (USA) (MSU1).wsquashfs → Mega_Man_X_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man X (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mega_man_x_(usa)_(msu1).sfc"
only new: {rom}
```

### 209. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man X Guitar Playthrough.wsquashfs` (1 game) — `squashfs_exe=mmx_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man X Guitar Playthrough.cfg" "<squashfs mount>\mmx_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man X Guitar Playthrough.wsquashfs → mmx_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man X Guitar Playthrough.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mmx_msu1.sfc"
only new: {rom}
```

### 210. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man X2 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mega_Man_X2_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man X2 (USA) (MSU1).cfg" "<squashfs mount>\Mega_Man_X2_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man X2 (USA) (MSU1).wsquashfs → Mega_Man_X2_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man X2 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mega_man_x2_(usa)_(msu1).sfc"
only new: {rom}
```

### 211. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man X3 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mega_Man_X3_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man X3 (USA) (MSU1).cfg" "<squashfs mount>\Mega_Man_X3_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man X3 (USA) (MSU1).wsquashfs → Mega_Man_X3_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man X3 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mega_man_x3_(usa)_(msu1).sfc"
only new: {rom}
```

### 212. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mega Man X3 Zero Project (MSU1).wsquashfs` (1 game) — `squashfs_exe=mmx3_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mega Man X3 Zero Project (MSU1).cfg" "<squashfs mount>\mmx3_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mega Man X3 Zero Project (MSU1).wsquashfs → mmx3_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mega Man X3 Zero Project (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mmx3_msu1.sfc"
only new: {rom}
```

### 213. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mickey Mania - The Timeless Adventures of Mickey Mouse (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mickey_Mania_-_The_Timeless_Adventures_of_Mickey_Mouse_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mickey Mania - The Timeless Adventures of Mickey Mouse (USA) (MSU1).cfg" "<squashfs mount>\Mickey_Mania_-_The_Timeless_Adventures_of_Mickey_Mouse_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mickey Mania - The Timeless Adventures of Mickey Mouse (USA) (MSU1).wsquashfs → Mickey_Mania_-_The_Timeless_Adventures_of_Mickey_Mouse_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mickey Mania - The Timeless Adventures of Mickey Mouse (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mickey_mania_-_the_timeless_adventures_of_mickey_mouse_(usa)_(msu1).sfc"
only new: {rom}
```

### 214. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Milk Utopia (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Milk Utopia (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Milk Utopia (USA) (MSU1).cfg" "<squashfs mount>\Milk Utopia (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Milk Utopia (USA) (MSU1).wsquashfs → Milk Utopia (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Milk Utopia (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\milk utopia (usa) (msu1) [n].sfc"
only new: {rom}
```

### 215. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mortal Kombat I (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mortal_Kombat_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mortal Kombat I (USA) (MSU1).cfg" "<squashfs mount>\Mortal_Kombat_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mortal Kombat I (USA) (MSU1).wsquashfs → Mortal_Kombat_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mortal Kombat I (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mortal_kombat_(usa)_(msu1).sfc"
only new: {rom}
```

### 216. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mortal Kombat III (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mortal_Kombat_3_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mortal Kombat III (USA) (MSU1).cfg" "<squashfs mount>\Mortal_Kombat_3_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mortal Kombat III (USA) (MSU1).wsquashfs → Mortal_Kombat_3_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mortal Kombat III (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mortal_kombat_3_(usa)_(msu1).sfc"
only new: {rom}
```

### 217. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mortal Kombat II (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mortal_Kombat_II_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mortal Kombat II (USA) (MSU1).cfg" "<squashfs mount>\Mortal_Kombat_II_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mortal Kombat II (USA) (MSU1).wsquashfs → Mortal_Kombat_II_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mortal Kombat II (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mortal_kombat_ii_(usa)_(msu1).sfc"
only new: {rom}
```

### 218. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Mother 2 - Giygas Strikes Back! (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Mother 2 - Giygas Strikes Back! (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Mother 2 - Giygas Strikes Back! (USA) (MSU1).cfg" "<squashfs mount>\Mother 2 - Giygas Strikes Back! (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Mother 2 - Giygas Strikes Back! (USA) (MSU1).wsquashfs → Mother 2 - Giygas Strikes Back! (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Mother 2 - Giygas Strikes Back! (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\mother 2 - giygas strikes back! (usa) (msu1) [n].sfc"
only new: {rom}
```

### 219. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `NBA Jam 2K21 - Tournament Edition (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=NBA Jam 2K21 - Tournament Edition (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\NBA Jam 2K21 - Tournament Edition (USA) (MSU1).cfg" "<squashfs mount>\NBA Jam 2K21 - Tournament Edition (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\NBA Jam 2K21 - Tournament Edition (USA) (MSU1).wsquashfs → NBA Jam 2K21 - Tournament Edition (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\NBA Jam 2K21 - Tournament Edition (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\nba jam 2k21 - tournament edition (usa) (msu1) [n].sfc"
only new: {rom}
```

### 220. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `NBA Jam 2K22 - Tournament Edition (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=NBA Jam 2K22 - Tournament Edition (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\NBA Jam 2K22 - Tournament Edition (USA) (MSU1).cfg" "<squashfs mount>\NBA Jam 2K22 - Tournament Edition (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\NBA Jam 2K22 - Tournament Edition (USA) (MSU1).wsquashfs → NBA Jam 2K22 - Tournament Edition (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\NBA Jam 2K22 - Tournament Edition (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\nba jam 2k22 - tournament edition (usa) (msu1) [n].sfc"
only new: {rom}
```

### 221. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `NBA Jam - Old-School Edition (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=NBA Jam - Old-School Edition (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\NBA Jam - Old-School Edition (USA) (MSU1).cfg" "<squashfs mount>\NBA Jam - Old-School Edition (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\NBA Jam - Old-School Edition (USA) (MSU1).wsquashfs → NBA Jam - Old-School Edition (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\NBA Jam - Old-School Edition (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\nba jam - old-school edition (usa) (msu1) [n].sfc"
only new: {rom}
```

### 222. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Ninja Gaiden Trilogy (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Ninja_Gaiden_Trilogy_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Ninja Gaiden Trilogy (USA) (MSU1).cfg" "<squashfs mount>\Ninja_Gaiden_Trilogy_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Ninja Gaiden Trilogy (USA) (MSU1).wsquashfs → Ninja_Gaiden_Trilogy_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Ninja Gaiden Trilogy (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ninja_gaiden_trilogy_(usa)_(msu1).sfc"
only new: {rom}
```

### 223. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Ninjawarriors (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=Ninjawarriors (USA).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Ninjawarriors (US) (MSU-1).cfg" "<squashfs mount>\Ninjawarriors (USA).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Ninjawarriors (US) (MSU-1).wsquashfs → Ninjawarriors (USA).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Ninjawarriors (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ninjawarriors (usa).sfc"
only new: {rom}
```

### 224. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Out of this World (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Out_of_this_World_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Out of this World (USA) (MSU1).cfg" "<squashfs mount>\Out_of_this_World_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Out of this World (USA) (MSU1).wsquashfs → Out_of_this_World_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Out of this World (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\out_of_this_world_(usa)_(msu1).sfc"
only new: {rom}
```

### 225. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Pilotwings (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Pilotwings_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Pilotwings (USA) (MSU1).cfg" "<squashfs mount>\Pilotwings_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Pilotwings (USA) (MSU1).wsquashfs → Pilotwings_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Pilotwings (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\pilotwings_(usa)_(msu1).sfc"
only new: {rom}
```

### 226. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Pitfall - The Mayan Adventure (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Pitfall_-_The_Mayan_Adventure_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Pitfall - The Mayan Adventure (USA) (MSU1).cfg" "<squashfs mount>\Pitfall_-_The_Mayan_Adventure_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Pitfall - The Mayan Adventure (USA) (MSU1).wsquashfs → Pitfall_-_The_Mayan_Adventure_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Pitfall - The Mayan Adventure (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\pitfall_-_the_mayan_adventure_(usa)_(msu1).sfc"
only new: {rom}
```

### 227. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Power Moves (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Power_Moves_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Power Moves (USA) (MSU1).cfg" "<squashfs mount>\Power_Moves_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Power Moves (USA) (MSU1).wsquashfs → Power_Moves_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Power Moves (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\power_moves_(usa)_(msu1).sfc"
only new: {rom}
```

### 228. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Pretty Soldier Sailor Moon (Japan) (MSU1)  [T-En].wsquashfs` (1 game) — `squashfs_exe=Pretty Soldier Sailor Moon (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon (Japan) (MSU1)  [T-En].cfg" "<squashfs mount>\Pretty Soldier Sailor Moon (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon (Japan) (MSU1)  [T-En].wsquashfs → Pretty Soldier Sailor Moon (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon (Japan) (MSU1)  [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\pretty soldier sailor moon (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 229. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En].wsquashfs → Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Pretty Soldier Sailor Moon - Another Story (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\pretty soldier sailor moon - another story (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 230. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Prince of Persia (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Prince_of_Persia_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Prince of Persia (USA) (MSU1).cfg" "<squashfs mount>\Prince_of_Persia_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Prince of Persia (USA) (MSU1).wsquashfs → Prince_of_Persia_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Prince of Persia (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\prince_of_persia_(usa)_(msu1).sfc"
only new: {rom}
```

### 231. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rendering Ranger R2 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=rrr2j-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rendering Ranger R2 (US) (MSU-1).cfg" "<squashfs mount>\rrr2j-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rendering Ranger R2 (US) (MSU-1).wsquashfs → rrr2j-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rendering Ranger R2 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rrr2j-msu1.sfc"
only new: {rom}
```

### 232. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Return of Double Dragon (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=rdd_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Return of Double Dragon (J) (MSU-1).cfg" "<squashfs mount>\rdd_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Return of Double Dragon (J) (MSU-1).wsquashfs → rdd_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Return of Double Dragon (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rdd_msu1.sfc"
only new: {rom}
```

### 233. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rival Turf! (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Rival_Turf!_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rival Turf! (USA) (MSU1).cfg" "<squashfs mount>\Rival_Turf!_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rival Turf! (USA) (MSU1).wsquashfs → Rival_Turf!_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rival Turf! (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rival_turf!_(usa)_(msu1).sfc"
only new: {rom}
```

### 234. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rock n' Roll Racing (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Rock_n'_Roll_Racing_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rock n' Roll Racing (USA) (MSU1).cfg" "<squashfs mount>\Rock_n'_Roll_Racing_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rock n' Roll Racing (USA) (MSU1).wsquashfs → Rock_n'_Roll_Racing_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rock n' Roll Racing (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rock_n'_roll_racing_(usa)_(msu1).sfc"
only new: {rom}
```

### 235. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rocketeer, The (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Rocketeer,_The_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rocketeer, The (USA) (MSU1).cfg" "<squashfs mount>\Rocketeer,_The_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rocketeer, The (USA) (MSU1).wsquashfs → Rocketeer,_The_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rocketeer, The (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rocketeer,_the_(usa)_(msu1).sfc"
only new: {rom}
```

### 236. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rockman & Forte (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Rockman_&_Forte_(Japan)_(MSU1)_[T-En].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rockman & Forte (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Rockman_&_Forte_(Japan)_(MSU1)_[T-En].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rockman & Forte (Japan) (MSU1) [T-En].wsquashfs → Rockman_&_Forte_(Japan)_(MSU1)_[T-En].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rockman & Forte (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rockman_&_forte_(japan)_(msu1)_[t-en].sfc"
only new: {rom}
```

### 237. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1) [T-En].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1).cfg" "<squashfs mount>\Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1) [T-En].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1).wsquashfs → Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1) [T-En].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rockman 7 - Shukumei no Taiketsu! (Japan) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rockman 7 - shukumei no taiketsu! (japan) (msu1) [t-en].sfc"
only new: {rom}
```

### 238. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `R-Type III (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=R-Type_III_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\R-Type III (USA) (MSU1).cfg" "<squashfs mount>\R-Type_III_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\R-Type III (USA) (MSU1).wsquashfs → R-Type_III_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\R-Type III (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\r-type_iii_(usa)_(msu1).sfc"
only new: {rom}
```

### 239. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Rushing Beat (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=rt_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Rushing Beat (J) (MSU-1).cfg" "<squashfs mount>\rt_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Rushing Beat (J) (MSU-1).wsquashfs → rt_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Rushing Beat (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\rt_msu1.sfc"
only new: {rom}
```

### 240. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Samurai Shodown (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=samsho_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Samurai Shodown (US) (MSU-1).cfg" "<squashfs mount>\samsho_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Samurai Shodown (US) (MSU-1).wsquashfs → samsho_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Samurai Shodown (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\samsho_msu.sfc"
only new: {rom}
```

### 241. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Saturday Night Slam Masters (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Saturday_Night_Slam_Masters_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Saturday Night Slam Masters (USA) (MSU1).cfg" "<squashfs mount>\Saturday_Night_Slam_Masters_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Saturday Night Slam Masters (USA) (MSU1).wsquashfs → Saturday_Night_Slam_Masters_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Saturday Night Slam Masters (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\saturday_night_slam_masters_(usa)_(msu1).sfc"
only new: {rom}
```

### 242. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Secret of Evermore (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Secret_of_Evermore_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Secret of Evermore (USA) (MSU1).cfg" "<squashfs mount>\Secret_of_Evermore_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Secret of Evermore (USA) (MSU1).wsquashfs → Secret_of_Evermore_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Secret of Evermore (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\secret_of_evermore_(usa)_(msu1).sfc"
only new: {rom}
```

### 243. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Secret of Mana (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Secret_of_Mana_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Secret of Mana (USA) (MSU1).cfg" "<squashfs mount>\Secret_of_Mana_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Secret of Mana (USA) (MSU1).wsquashfs → Secret_of_Mana_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Secret of Mana (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\secret_of_mana_(usa)_(msu1).sfc"
only new: {rom}
```

### 244. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Shaq-Fu (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=shfu_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Shaq-Fu (US) (MSU-1).cfg" "<squashfs mount>\shfu_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Shaq-Fu (US) (MSU-1).wsquashfs → shfu_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Shaq-Fu (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\shfu_msu1.sfc"
only new: {rom}
```

### 245. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Gundam Wing Endless Duel (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=msgw_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Gundam Wing Endless Duel (J) (MSU-1).cfg" "<squashfs mount>\msgw_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Gundam Wing Endless Duel (J) (MSU-1).wsquashfs → msgw_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Gundam Wing Endless Duel (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\msgw_msu1.sfc"
only new: {rom}
```

### 246. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Shin Megami Tensei (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=shinmegamitensei_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).cfg" "<squashfs mount>\shinmegamitensei_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).wsquashfs → shinmegamitensei_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\shinmegamitensei_msu.sfc"
only new: {rom}
```

### 247. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Shin Megami Tensei (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=shinmegamitensei_msu.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).cfg" "<squashfs mount>\shinmegamitensei_msu.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).wsquashfs → shinmegamitensei_msu.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Shin Megami Tensei (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\shinmegamitensei_msu.smc"
only new: {rom}
```

### 248. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Sim City (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Sim_City_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Sim City (USA) (MSU1).cfg" "<squashfs mount>\Sim_City_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Sim City (USA) (MSU1).wsquashfs → Sim_City_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Sim City (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sim_city_(usa)_(msu1).sfc"
only new: {rom}
```

### 249. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `The Simpsons Bart's Nightmare (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=bn_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\The Simpsons Bart's Nightmare (US) (MSU-1).cfg" "<squashfs mount>\bn_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\The Simpsons Bart's Nightmare (US) (MSU-1).wsquashfs → bn_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\The Simpsons Bart's Nightmare (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\bn_msu1.sfc"
only new: {rom}
```

### 250. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Star Ocean (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=so_msu1.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).cfg" "<squashfs mount>\so_msu1.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).wsquashfs → so_msu1.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\so_msu1.smc"
only new: {rom}
```

### 251. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Soul Blazer (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Soul_Blazer_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Soul Blazer (USA) (MSU1).cfg" "<squashfs mount>\Soul_Blazer_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Soul Blazer (USA) (MSU1).wsquashfs → Soul_Blazer_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Soul Blazer (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\soul_blazer_(usa)_(msu1).sfc"
only new: {rom}
```

### 252. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Star Fox (US) (MSU-1) (FX 21 MHz).wsquashfs` (1 game) — `squashfs_exe=sfx_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Star Fox (US) (MSU-1) (FX 21 MHz).cfg" "<squashfs mount>\sfx_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Star Fox (US) (MSU-1) (FX 21 MHz).wsquashfs → sfx_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Star Fox (US) (MSU-1) (FX 21 MHz).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sfx_msu1.sfc"
only new: {rom}
```

### 253. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Star Ocean (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=so_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).cfg" "<squashfs mount>\so_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).wsquashfs → so_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Star Ocean (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\so_msu1.sfc"
only new: {rom}
```

### 254. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Stories of Ihatovo, The (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Stories of Ihatovo, The (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Stories of Ihatovo, The (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Stories of Ihatovo, The (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Stories of Ihatovo, The (Japan) (MSU1) [T-En].wsquashfs → Stories of Ihatovo, The (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Stories of Ihatovo, The (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\stories of ihatovo, the (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 255. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Street Fighter Alpha 2 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=sfa2-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Street Fighter Alpha 2 (US) (MSU-1).cfg" "<squashfs mount>\sfa2-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Street Fighter Alpha 2 (US) (MSU-1).wsquashfs → sfa2-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Street Fighter Alpha 2 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sfa2-msu1.sfc"
only new: {rom}
```

### 256. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Street Fighter II (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Street_Fighter_II_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Street Fighter II (USA) (MSU1).cfg" "<squashfs mount>\Street_Fighter_II_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Street Fighter II (USA) (MSU1).wsquashfs → Street_Fighter_II_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Street Fighter II (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\street_fighter_ii_(usa)_(msu1).sfc"
only new: {rom}
```

### 257. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Street Fighter II Turbo (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Street_Fighter_II_Turbo_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Street Fighter II Turbo (USA) (MSU1).cfg" "<squashfs mount>\Street_Fighter_II_Turbo_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Street Fighter II Turbo (USA) (MSU1).wsquashfs → Street_Fighter_II_Turbo_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Street Fighter II Turbo (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\street_fighter_ii_turbo_(usa)_(msu1).sfc"
only new: {rom}
```

### 258. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Street Fighter II' Turbo Hyper Fighting (Arcade MSU-1).wsquashfs` (1 game) — `squashfs_exe=sf2t_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Street Fighter II' Turbo Hyper Fighting (Arcade MSU-1).cfg" "<squashfs mount>\sf2t_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Street Fighter II' Turbo Hyper Fighting (Arcade MSU-1).wsquashfs → sf2t_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Street Fighter II' Turbo Hyper Fighting (Arcade MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sf2t_msu1.sfc"
only new: {rom}
```

### 259. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Sunset Riders (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=sriders-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Sunset Riders (US) (MSU-1).cfg" "<squashfs mount>\sriders-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Sunset Riders (US) (MSU-1).wsquashfs → sriders-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Sunset Riders (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sriders-msu1.sfc"
only new: {rom}
```

### 260. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Bomberman 3 MSU.wsquashfs` (1 game) — `squashfs_exe=sb3_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Bomberman 3 MSU.cfg" "<squashfs mount>\sb3_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Bomberman 3 MSU.wsquashfs → sb3_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Bomberman 3 MSU.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sb3_msu.sfc"
only new: {rom}
```

### 261. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario Bros. CD - Speedrun Competition (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Super Mario Bros. CD - Speedrun Competition (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario Bros. CD - Speedrun Competition (USA) (MSU1).cfg" "<squashfs mount>\Super Mario Bros. CD - Speedrun Competition (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario Bros. CD - Speedrun Competition (USA) (MSU1).wsquashfs → Super Mario Bros. CD - Speedrun Competition (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario Bros. CD - Speedrun Competition (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super mario bros. cd - speedrun competition (usa) (msu1) [n].sfc"
only new: {rom}
```

### 262. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario Kart (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=smk_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario Kart (US) (MSU-1).cfg" "<squashfs mount>\smk_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario Kart (US) (MSU-1).wsquashfs → smk_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario Kart (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\smk_msu1.sfc"
only new: {rom}
```

### 263. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario Odyssey (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Super Mario Odyssey (USA) (MSU1) [i] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario Odyssey (USA) (MSU1).cfg" "<squashfs mount>\Super Mario Odyssey (USA) (MSU1) [i] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario Odyssey (USA) (MSU1).wsquashfs → Super Mario Odyssey (USA) (MSU1) [i] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario Odyssey (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super mario odyssey (usa) (msu1) [i] [n].sfc"
only new: {rom}
```

### 264. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario RPG (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=smrpg_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario RPG (USA) (MSU1).cfg" "<squashfs mount>\smrpg_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario RPG (USA) (MSU1).wsquashfs → smrpg_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario RPG (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\smrpg_msu1.sfc"
only new: {rom}
```

### 265. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario World (MSU-1) (US).wsquashfs` (1 game) — `squashfs_exe=Super Mario World (USA) (MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario World (MSU-1) (US).cfg" "<squashfs mount>\Super Mario World (USA) (MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario World (MSU-1) (US).wsquashfs → Super Mario World (USA) (MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario World (MSU-1) (US).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super mario world (usa) (msu1).sfc"
only new: {rom}
```

### 266. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario World Co-op (MSU1).wsquashfs` (1 game) — `squashfs_exe=smwc_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario World Co-op (MSU1).cfg" "<squashfs mount>\smwc_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario World Co-op (MSU1).wsquashfs → smwc_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario World Co-op (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\smwc_msu1.sfc"
only new: {rom}
```

### 267. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Mario World Plus Ultra (MSU-1) (US).wsquashfs` (1 game) — `squashfs_exe=smw_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Mario World Plus Ultra (MSU-1) (US).cfg" "<squashfs mount>\smw_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Mario World Plus Ultra (MSU-1) (US).wsquashfs → smw_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Mario World Plus Ultra (MSU-1) (US).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\smw_msu1.sfc"
only new: {rom}
```

### 268. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Metroid x A Link to the Past Randomizer.wsquashfs` (1 game) — `squashfs_exe=sm_alttp_randomizer_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Metroid x A Link to the Past Randomizer.cfg" "<squashfs mount>\sm_alttp_randomizer_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Metroid x A Link to the Past Randomizer.wsquashfs → sm_alttp_randomizer_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Metroid x A Link to the Past Randomizer.wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\sm_alttp_randomizer_msu1.sfc"
only new: {rom}
```

### 269. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Metroid Phazon (MSU-1).wsquashfs` (1 game) — `squashfs_exe=phazon_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Metroid Phazon (MSU-1).cfg" "<squashfs mount>\phazon_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Metroid Phazon (MSU-1).wsquashfs → phazon_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Metroid Phazon (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\phazon_msu1.sfc"
only new: {rom}
```

### 270. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Metroid Project Base (MSU-1).wsquashfs` (1 game) — `squashfs_exe=super-metroid-msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Metroid Project Base (MSU-1).cfg" "<squashfs mount>\super-metroid-msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Metroid Project Base (MSU-1).wsquashfs → super-metroid-msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Metroid Project Base (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super-metroid-msu.sfc"
only new: {rom}
```

### 271. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Metroid Symphony (MSU-1).wsquashfs` (1 game) — `squashfs_exe=supermetroids-msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Metroid Symphony (MSU-1).cfg" "<squashfs mount>\supermetroids-msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Metroid Symphony (MSU-1).wsquashfs → supermetroids-msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Metroid Symphony (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\supermetroids-msu.sfc"
only new: {rom}
```

### 272. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Metroid Randomizer (MSU-1 Alternate Metroid Music).wsquashfs` (1 game) — `squashfs_exe=supermetroid_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Metroid Randomizer (MSU-1 Alternate Metroid Music).cfg" "<squashfs mount>\supermetroid_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Metroid Randomizer (MSU-1 Alternate Metroid Music).wsquashfs → supermetroid_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Metroid Randomizer (MSU-1 Alternate Metroid Music).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\supermetroid_msu1.sfc"
only new: {rom}
```

### 273. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Off Road (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Super_Off_Road_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Off Road (USA) (MSU1).cfg" "<squashfs mount>\Super_Off_Road_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Off Road (USA) (MSU1).wsquashfs → Super_Off_Road_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Off Road (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super_off_road_(usa)_(msu1).sfc"
only new: {rom}
```

### 274. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Road Blaster (MSU-1).wsquashfs` (1 game) — `squashfs_exe=SuperRoadBlaster.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Road Blaster (MSU-1).cfg" "<squashfs mount>\SuperRoadBlaster.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Road Blaster (MSU-1).wsquashfs → SuperRoadBlaster.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Road Blaster (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\superroadblaster.sfc"
only new: {rom}
```

### 275. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Scope 6 (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Super_Scope_6_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Scope 6 (USA) (MSU1).cfg" "<squashfs mount>\Super_Scope_6_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Scope 6 (USA) (MSU1).wsquashfs → Super_Scope_6_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Scope 6 (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super_scope_6_(usa)_(msu1).sfc"
only new: {rom}
```

### 276. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Smash T.V. (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=stv_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Smash T.V. (US) (MSU-1).cfg" "<squashfs mount>\stv_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Smash T.V. (US) (MSU-1).wsquashfs → stv_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Smash T.V. (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\stv_msu.sfc"
only new: {rom}
```

### 277. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Spongebob Kart (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Super Spongebob Kart (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Spongebob Kart (USA) (MSU1).cfg" "<squashfs mount>\Super Spongebob Kart (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Spongebob Kart (USA) (MSU1).wsquashfs → Super Spongebob Kart (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Spongebob Kart (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\super spongebob kart (usa) (msu1) [n].sfc"
only new: {rom}
```

### 278. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Super Turrican 2 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=st2-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Super Turrican 2 (US) (MSU-1).cfg" "<squashfs mount>\st2-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Super Turrican 2 (US) (MSU-1).wsquashfs → st2-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Super Turrican 2 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\st2-msu1.sfc"
only new: {rom}
```

### 279. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `T2 - The Arcade Game (USA,) (MSU1).wsquashfs` (1 game) — `squashfs_exe=t2a_msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\T2 - The Arcade Game (USA,) (MSU1).cfg" "<squashfs mount>\t2a_msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\T2 - The Arcade Game (USA,) (MSU1).wsquashfs → t2a_msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\T2 - The Arcade Game (USA,) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\t2a_msu.sfc"
only new: {rom}
```

### 280. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Tales Of Phantasia (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=top_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).cfg" "<squashfs mount>\top_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).wsquashfs → top_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\top_msu1.sfc"
only new: {rom}
```

### 281. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Terranigma (Europe) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Terranigma_(Europe)_(MSU1)_[f_NTSC].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Terranigma (Europe) (MSU1).cfg" "<squashfs mount>\Terranigma_(Europe)_(MSU1)_[f_NTSC].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Terranigma (Europe) (MSU1).wsquashfs → Terranigma_(Europe)_(MSU1)_[f_NTSC].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Terranigma (Europe) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\terranigma_(europe)_(msu1)_[f_ntsc].sfc"
only new: {rom}
```

### 282. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Top Gear (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=topgear_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Top Gear (US) (MSU-1).cfg" "<squashfs mount>\topgear_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Top Gear (US) (MSU-1).wsquashfs → topgear_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Top Gear (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\topgear_msu1.sfc"
only new: {rom}
```

### 283. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Top Gear 2 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=tg2_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Top Gear 2 (US) (MSU-1).cfg" "<squashfs mount>\tg2_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Top Gear 2 (US) (MSU-1).wsquashfs → tg2_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Top Gear 2 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\tg2_msu1.sfc"
only new: {rom}
```

### 284. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Top Gear 3000 (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=tg3k_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Top Gear 3000 (US) (MSU-1).cfg" "<squashfs mount>\tg3k_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Top Gear 3000 (US) (MSU-1).wsquashfs → tg3k_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Top Gear 3000 (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\tg3k_msu1.sfc"
only new: {rom}
```

### 285. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Tales Of Phantasia (J) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=top_msu1.smc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).cfg" "<squashfs mount>\top_msu1.smc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).wsquashfs → top_msu1.smc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Tales Of Phantasia (J) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\top_msu1.smc"
only new: {rom}
```

### 286. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Toy Story (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=ts-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Toy Story (US) (MSU-1).cfg" "<squashfs mount>\ts-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Toy Story (US) (MSU-1).wsquashfs → ts-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Toy Story (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ts-msu1.sfc"
only new: {rom}
```

### 287. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Turrican 4 (Japan) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Turrican 4 (Japan) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Turrican 4 (Japan) (MSU1).cfg" "<squashfs mount>\Turrican 4 (Japan) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Turrican 4 (Japan) (MSU1).wsquashfs → Turrican 4 (Japan) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Turrican 4 (Japan) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\turrican 4 (japan) (msu1) [n].sfc"
only new: {rom}
```

### 288. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `U.N. Squadron (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=U.N._Squadron_(USA)_(MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\U.N. Squadron (USA) (MSU1).cfg" "<squashfs mount>\U.N._Squadron_(USA)_(MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\U.N. Squadron (USA) (MSU1).wsquashfs → U.N._Squadron_(USA)_(MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\U.N. Squadron (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\u.n._squadron_(usa)_(msu1).sfc"
only new: {rom}
```

### 289. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Ultimate Mortal Kombat 3 (Deluxe hack) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=umk3_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Ultimate Mortal Kombat 3 (Deluxe hack) (MSU-1).cfg" "<squashfs mount>\umk3_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Ultimate Mortal Kombat 3 (Deluxe hack) (MSU-1).wsquashfs → umk3_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Ultimate Mortal Kombat 3 (Deluxe hack) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\umk3_msu1.sfc"
only new: {rom}
```

### 290. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Wild Guns (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=wguns-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Wild Guns (US) (MSU-1).cfg" "<squashfs mount>\wguns-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Wild Guns (US) (MSU-1).wsquashfs → wguns-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Wild Guns (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\wguns-msu1.sfc"
only new: {rom}
```

### 291. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Wolfchild (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=wc-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Wolfchild (US) (MSU-1).cfg" "<squashfs mount>\wc-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Wolfchild (US) (MSU-1).wsquashfs → wc-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Wolfchild (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\wc-msu1.sfc"
only new: {rom}
```

### 292. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Wolfenstein 3D SNES (Redux) (Roland SC-55 Midi OST).wsquashfs` (1 game) — `squashfs_exe=Wolfenstein3DReduxMSU1.msu.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Wolfenstein 3D SNES (Redux) (Roland SC-55 Midi OST).cfg" "<squashfs mount>\Wolfenstein3DReduxMSU1.msu.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Wolfenstein 3D SNES (Redux) (Roland SC-55 Midi OST).wsquashfs → Wolfenstein3DReduxMSU1.msu.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Wolfenstein 3D SNES (Redux) (Roland SC-55 Midi OST).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\wolfenstein3dreduxmsu1.msu.sfc"
only new: {rom}
```

### 293. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `World Heroes 2 (US) (MSU1).wsquashfs` (1 game) — `squashfs_exe=World Heroes 2 (USA) (MSU1).sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\World Heroes 2 (US) (MSU1).cfg" "<squashfs mount>\World Heroes 2 (USA) (MSU1).sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\World Heroes 2 (US) (MSU1).wsquashfs → World Heroes 2 (USA) (MSU1).sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\World Heroes 2 (US) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\world heroes 2 (usa) (msu1).sfc"
only new: {rom}
```

### 294. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Xardion (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=xar-msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Xardion (US) (MSU-1).cfg" "<squashfs mount>\xar-msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Xardion (US) (MSU-1).wsquashfs → xar-msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Xardion (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\xar-msu1.sfc"
only new: {rom}
```

### 295. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Yoshi's Lullaby (MSU1).wsquashfs` (1 game) — `squashfs_exe=yl_msu1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Yoshi's Lullaby (MSU1).cfg" "<squashfs mount>\yl_msu1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Yoshi's Lullaby (MSU1).wsquashfs → yl_msu1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Yoshi's Lullaby (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\yl_msu1.sfc"
only new: {rom}
```

### 296. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Yoshi's Strange Quest (USA) (MSU1).wsquashfs` (1 game) — `squashfs_exe=Yoshi's Strange Quest (USA) (MSU1) [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Yoshi's Strange Quest (USA) (MSU1).cfg" "<squashfs mount>\Yoshi's Strange Quest (USA) (MSU1) [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Yoshi's Strange Quest (USA) (MSU1).wsquashfs → Yoshi's Strange Quest (USA) (MSU1) [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Yoshi's Strange Quest (USA) (MSU1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\yoshi's strange quest (usa) (msu1) [n].sfc"
only new: {rom}
```

### 297. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En].wsquashfs` (1 game) — `squashfs_exe=Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En] [n].sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En].cfg" "<squashfs mount>\Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En] [n].sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En].wsquashfs → Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En] [n].sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Ys V - Kefin, Lost Kingdom of Sand (Japan) (MSU1) [T-En].wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\ys v - kefin, lost kingdom of sand (japan) (msu1) [t-en] [n].sfc"
only new: {rom}
```

### 298. args — 1 system, 1 variant, 1 game

Systems: Nintendo SNES MSU-1.

Example: Nintendo SNES MSU-1 · `Zombies Ate My Neighbors (US) (MSU-1).wsquashfs` (1 game) — `squashfs_exe=Zombies Ate My Neighbors (USA) MSU-1.sfc`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\snes9x_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Nintendo SNES MSU-1\Zombies Ate My Neighbors (US) (MSU-1).cfg" "<squashfs mount>\Zombies Ate My Neighbors (USA) MSU-1.sfc"
     cwd: e:\NextLevel\emulators\retroarch
     mounts first: e:\NextLevel\systems\Nintendo SNES MSU-1\Zombies Ate My Neighbors (US) (MSU-1).wsquashfs → Zombies Ate My Neighbors (USA) MSU-1.sfc
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\snes9x_libretro.dll "e:\roms\Nintendo SNES MSU-1\Zombies Ate My Neighbors (US) (MSU-1).wsquashfs"
     profile: RetroArch – snes9x
     cwd: E:\NextLevel\emulators\retroarch
     note: ROM file not found
only old: -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg (missing) "<squashfs mount>\zombies ate my neighbors (usa) msu-1.sfc"
only new: {rom}
```

### 299. newError — 1 system, 1 variant, 1 game

Systems: Pinball Wicked.

Example: Pinball Wicked · `PinballWicked.lnk` (1 game)

```text
old: "e:/NextLevel/systems/Pinball Wicked/PinballWicked.lnk"
     cwd: C:\lestivalet\NextLevelOS\public
new: ERROR NO_PROFILE
```

### 300. newError — 1 system, 1 variant, 1 game

Systems: Pioneer LaserActive.

Example: Pioneer LaserActive · `Hyperion.bat` (1 game)

```text
old: "e:\NextLevel\systems\Pioneer LaserActive\Hyperion.bat" none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 301. newError — 1 system, 1 variant, 1 game

Systems: Pokkito.

Example: Pokkito · `Jetpack.bat` (1 game)

```text
old: e:\NextLevel\systems\Pokkito\Jetpack.bat none
     cwd: (launcher folder)
new: ERROR NO_PROFILE
```

### 302. args — 1 system, 1 variant, 1 game

Systems: Sony Playstation.

Example: Sony Playstation · `X-Files, The (USA).m3u` (1 game) — `core=pcsx_rearmed_libretro`

```text
old: e:/NextLevel/emulators/retroarch/retroarch.exe -L e:/NextLevel/emulators/retroarch/cores\duckstation_libretro.dll -c "e:/NextLevel/emulators/retroarch/config\Sony Playstation.cfg" --appendconfig "e:/NextLevel/emulators/retroarch/config\Sony Playstation\X-Files, The (USA).cfg" "e:\roms\Sony Playstation\X-Files, The (USA).m3u"
     cwd: e:\NextLevel\emulators\retroarch
new: E:\NextLevel\emulators\retroarch\retroarch.exe -L E:\NextLevel\emulators\retroarch\cores\pcsx_rearmed_libretro.dll "e:\roms\Sony Playstation\X-Files, The (USA).m3u"
     profile: RetroArch – duckstation
     cwd: E:\NextLevel\emulators\retroarch
only old: {emulatorDir}\cores\duckstation_libretro.dll -c {emulatorDir}\config\{system}.cfg --appendconfig {emulatorDir}\config\{system}\{romName}.cfg
only new: {emulatorDir}\cores\pcsx_rearmed_libretro.dll
```

### 303. bothError — 1 system, 1 variant, 1 game

Systems: Taito Type X Zero.

Example: Taito Type X Zero · `GrooveCoaster2.squashfs` (1 game)

```text
old: ERROR Error: Unknown system 'Taito Type X Zero'
new: ERROR NO_PROFILE
```

### 304. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80.

Example: Tandy TRS-80 · `AdamsAdventures1.DSK` (1 game) — `mame_media=flop1`

```text
old: e:/NextLevel/emulators/mame/mame.exe trs80m3 -flop1 "e:\NextLevel\systems\Tandy TRS-80\MULTIDOS.DSK" -flop2 "e:\NextLevel\systems\Tandy TRS-80\AdamsAdventures1.DSK" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe trs80m3 -cass "E:\NextLevel\systems\Tandy TRS-80\AdamsAdventures1.DSK" -rompath "E:\NextLevel\systems\Tandy TRS-80" -skip_gameinfo
     profile: MAME – Tandy TRS-80
     cwd: e:\NextLevel\emulators\mame
only old: -flop1 {systemDir}\multidos.dsk -flop2 -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 305. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80.

Example: Tandy TRS-80 · `frogger1.zip` (1 game) — `mame_media=quik`

```text
old: e:/NextLevel/emulators/mame/mame.exe trs80m3 -quik "e:\NextLevel\systems\Tandy TRS-80\frogger1.zip" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe trs80m3 -cass "E:\NextLevel\systems\Tandy TRS-80\frogger1.zip" -rompath "E:\NextLevel\systems\Tandy TRS-80" -skip_gameinfo
     profile: MAME – Tandy TRS-80
     cwd: e:\NextLevel\emulators\mame
only old: -quik -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 306. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80 Color Computer.

Example: Tandy TRS-80 Color Computer · `Galactic Attack (1982).rom` (1 game) — `mame_media=cart`

```text
old: e:/NextLevel/emulators/mame/mame.exe coco3 -cart "e:\NextLevel\systems\Tandy TRS-80 Color Computer\Galactic Attack (1982).rom" -autoboot_delay 5 -autoboot_command %COMMANDS% -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80 Color Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe coco3 -cart "E:\NextLevel\systems\Tandy TRS-80 Color Computer\Galactic Attack (1982).rom" -rompath "E:\NextLevel\systems\Tandy TRS-80 Color Computer" -skip_gameinfo
     profile: MAME – Tandy TRS-80 Color Computer
     cwd: e:\NextLevel\emulators\mame
only old: -autoboot_delay 5 -autoboot_command %commands% -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
```

### 307. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80 Color Computer.

Example: Tandy TRS-80 Color Computer · `q-bert.dsk` (1 game) — `launch_args=RUN""Q*BERT+""\n`, `mame_media=flop1`

```text
old: e:/NextLevel/emulators/mame/mame.exe coco3 -flop1 "e:\NextLevel\systems\Tandy TRS-80 Color Computer\q-bert.dsk" -autoboot_delay 5 -autoboot_command RUNQ*BERT+\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80 Color Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe coco3 -cart "E:\NextLevel\systems\Tandy TRS-80 Color Computer\q-bert.dsk" -rompath "E:\NextLevel\systems\Tandy TRS-80 Color Computer" -skip_gameinfo
     profile: MAME – Tandy TRS-80 Color Computer
     cwd: e:\NextLevel\emulators\mame
only old: -flop1 -autoboot_delay 5 -autoboot_command runq*bert+\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 308. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80 Color Computer.

Example: Tandy TRS-80 Color Computer · `Tetris (Tandy) (Coco 1-2, coco 3).cas` (1 game) — `launch_args=CLOADM:EXEC\n`, `mame_media=cass`

```text
old: e:/NextLevel/emulators/mame/mame.exe coco3 -cass "e:\NextLevel\systems\Tandy TRS-80 Color Computer\Tetris (Tandy) (Coco 1-2, coco 3).cas" -autoboot_delay 5 -autoboot_command CLOADM:EXEC\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80 Color Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe coco3 -cart "E:\NextLevel\systems\Tandy TRS-80 Color Computer\Tetris (Tandy) (Coco 1-2, coco 3).cas" -rompath "E:\NextLevel\systems\Tandy TRS-80 Color Computer" -skip_gameinfo
     profile: MAME – Tandy TRS-80 Color Computer
     cwd: e:\NextLevel\emulators\mame
only old: -cass -autoboot_delay 5 -autoboot_command cloadm:exec\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 309. args — 1 system, 1 variant, 1 game

Systems: Tandy TRS-80 Color Computer.

Example: Tandy TRS-80 Color Computer · `THEXDER.DSK` (1 game) — `launch_args=LOADM\&quot;thexder\&quot;:EXEC\n`, `mame_media=flop1`

```text
old: e:/NextLevel/emulators/mame/mame.exe coco3 -flop1 "e:\NextLevel\systems\Tandy TRS-80 Color Computer\THEXDER.DSK" -autoboot_delay 5 -autoboot_command LOADM\&quot;thexder\&quot;:EXEC\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Tandy TRS-80 Color Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe coco3 -cart "E:\NextLevel\systems\Tandy TRS-80 Color Computer\THEXDER.DSK" -rompath "E:\NextLevel\systems\Tandy TRS-80 Color Computer" -skip_gameinfo
     profile: MAME – Tandy TRS-80 Color Computer
     cwd: e:\NextLevel\emulators\mame
only old: -flop1 -autoboot_delay 5 -autoboot_command loadm\&quot;thexder\&quot;:exec\n -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cart
```

### 310. oldError — 1 system, 1 variant, 1 game

Systems: TimeTop GameKing 3.

Example: TimeTop GameKing 3 · `vagrant` (1 game)

```text
old: ERROR Error: Unknown system 'TimeTop Gameking 3'
new: e:\NextLevel\emulators\mame\mame.exe gamekin3 -cart "e:\roms\TimeTop GameKing 3\vagrant" -rompath "e:\roms\TimeTop GameKing 3" -skip_gameinfo
     profile: MAME – TimeTop GameKing 3
     cwd: e:\NextLevel\emulators\mame
     note: ROM file not found
```

### 311. args — 1 system, 1 variant, 1 game

Systems: Tronica.

Example: Tronica · `trspacmis.zip` (1 game) — `core=trspider`

```text
old: e:/NextLevel/emulators/mame/mame.exe trspider -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath e:\NextLevel\systems\Tronica
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe trspacmis -rompath E:\NextLevel\systems\Tronica -skip_gameinfo
     profile: MAME – Tronica
     cwd: e:\NextLevel\emulators\mame
only old: trspider -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: trspacmis
```

### 312. args — 1 system, 1 variant, 1 game

Systems: Tronica.

Example: Tronica · `trsrescue.zip` (1 game) — `core=trthuball`

```text
old: e:/NextLevel/emulators/mame/mame.exe trthuball -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath e:\NextLevel\systems\Tronica
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe trsrescue -rompath E:\NextLevel\systems\Tronica -skip_gameinfo
     profile: MAME – Tronica
     cwd: e:\NextLevel\emulators\mame
only old: trthuball -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: trsrescue
```

### 313. args — 1 system, 1 variant, 1 game

Systems: Videoton TV Computer.

Example: Videoton TV Computer · `alien8.dsk` (1 game) — `mame_media=flop1`

```text
old: e:/NextLevel/emulators/mame/mame.exe tvc64 -exp1 hbf -flop1 "e:\NextLevel\systems\Videoton TV Computer\alien8.dsk" -autoboot_delay 5 -autoboot_command LOAD""\n -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Videoton TV Computer"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe tvc64 -cass "E:\NextLevel\systems\Videoton TV Computer\alien8.dsk" -autoboot_delay 5 -autoboot_command LOAD""\n -rompath "E:\NextLevel\systems\Videoton TV Computer" -skip_gameinfo
     profile: MAME – Videoton TV Computer
     cwd: e:\NextLevel\emulators\mame
only old: -exp1 hbf -flop1 -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del
only new: -cass
```

### 314. args — 1 system, 1 variant, 1 game

Systems: Z80 TV Game System.

Example: Z80 TV Game System · `tvgame` (1 game)

```text
old: e:/NextLevel/emulators/mame/mame.exe tvgame -uimodekey DEL -skip_gameinfo -nowindow -rompath "e:\NextLevel\systems\Z80 TV Game System" -artpath e:/NextLevel/emulators/mame/artwork -cfg_directory e:/NextLevel/emulators/mame/cfg -snapshot_directory e:/NextLevel/emulators/mame/snap -nvram_directory e:/NextLevel/emulators/mame/nvram -diff_directory e:/NextLevel/emulators/mame/diff -hashpath e:/NextLevel/emulators/mame/hash -languagepath e:/NextLevel/emulators/mame/language -inipath e:/NextLevel/emulators/mame/ -uimodekey DEL -skip_gameinfo -rompath "e:\NextLevel\systems\Z80 TV Game System"
     cwd: e:\NextLevel\emulators\mame
new: e:\NextLevel\emulators\mame\mame.exe tvgame -uimodekey DEL -skip_gameinfo -nowindow -rompath "e:\roms\Z80 TV Game System" -skip_gameinfo
     profile: MAME – Z80 TV Game System
     cwd: e:\NextLevel\emulators\mame
     note: ROM file not found
only old: -artpath {emulatorDir}\artwork -cfg_directory {emulatorDir}\cfg -snapshot_directory {emulatorDir}\snap -nvram_directory {emulatorDir}\nvram -diff_directory {emulatorDir}\diff -hashpath {emulatorDir}\hash -languagepath {emulatorDir}\language -inipath {emulatorDir} -uimodekey del -rompath {systemDir} (missing)
```
