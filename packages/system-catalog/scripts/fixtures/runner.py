# Trimmed shape of NextLevelOS public/nextlevel-launcher.py (test fixture, no real paths).
SYSTEM_EMULATORS = {
    "Nintendo 64": ["retroarch"],
    "Apple II": ["mame", "retroarch"],
    "Nintendo GameCube": ["dolphin"],
    "Tandy TRS-80": ["mame"],
    "Acorn Atom": ["mame"],
    "Sega Model 2": ["model2"],
}

MAME_CUSTOM_ARGS = {
    "Apple II":['apple2ee', '-gameio', 'joy', '-flop1', '%ROM_PATH%'],
    #"Apple II": ['apple2', '-flop1', '%ROM_PATH%'],
    'Acorn Atom': ['atom', '-%MEDIA%', '%ROM_PATH%', '-keyboardprovider', 'dinput','-autoboot_delay', '2', '-autoboot_command', '%COMMANDS%'],
    "Tandy TRS-80": "trs80_args",
    "Sharp MZ-700":  ['mz700', '-cass', '%ROM_PATH%', '-autoboot_delay', '2', '-autoboot_command', "LOAD\\n"],
    "Kaypro II":  ['kayproii', '-flop1', '%SYSTEM_PATH%\\cpm22.zip', '-%MEDIA%', '%ROM_PATH%'], # trailing ['x']
}
