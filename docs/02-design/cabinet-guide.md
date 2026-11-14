# Cabinet guide: kiosk mode

For arcade cabinets and shared PCs (FR-SET-6, US-D4, D54): guests can play from the front-end,
but can't change settings, open the desktop or quit.

## Turn it on

1. **Settings → Kiosk → Kiosk mode**: on.
2. Type a **New PIN** of 4 to 8 digits and type it again in **PIN again**.
3. Under **While locked, hide**, untick anything guests may use. Everything is ticked at first:
   Desktop, Settings (and the Menu Editor), Theme switcher, Catalog, Account, Quit.
4. **Save**. **Lock now** locks it at once; it is also locked at every start.

While locked, the hidden parts are gone from the desktop, the Start menu, the tray and the
front-end's menu, and NextLevel refuses them behind the scenes too. With the desktop hidden, the
front-end stays open, even if NextLevel is set to start at the desktop.

## Unlock it

Hold **Esc** (keyboard) or **Start** (gamepad) for 3 seconds: the PIN pad opens. Enter the PIN with
the arrows or d-pad and select or A, or type the digits. It stays unlocked until NextLevel
restarts or someone chooses **Lock now**. Five wrong PINs make the pad wait a minute.

## Forgot the PIN

Quit NextLevel (or restart the PC), create an empty file named `reset-kiosk` next to
`NextLevel.exe` and start NextLevel. Kiosk mode is off and the PIN forgotten; the file is
deleted. Anyone with access to the NextLevel folder can do this, so keep the PC's own login or
the folder protected if that matters.

## Tips for a cabinet

- **Settings → General → Start with Windows** and a boot target of a theme opens straight into
  the front-end.
- **Settings → Sync** is off by default; leave it off on a public cabinet unless you want its
  plays counted on your account.
- Updates still download in the background and install when NextLevel next closes; while Quit
  is hidden, **Restart to update** waits for an unlock.
