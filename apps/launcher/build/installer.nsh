; NextLevel installer additions (D50, D51), included by electron-builder in both the installer
; and the uninstaller build.
;
; - New installs default to C:\NextLevel; folders under Program Files are refused (not writable,
;   and the launcher keeps its data next to NextLevel.exe).
; - Uninstalling (and the uninstall step of an update) removes only the app's own files: the
;   data\ and Catalog\ folders, and anything else the user put there, are kept.

!macro preInit
  ; electron-builder takes the default folder from InstallLocation; set it only when this PC has
  ; no earlier install, so an update stays where it is.
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $0 == ""
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\NextLevel"
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
  ; Disables Next while the chosen folder is under Program Files.
  Function .onVerifyInstDir
    Push $R0
    Push $R1
    StrLen $R1 "$PROGRAMFILES64"
    StrCpy $R0 "$INSTDIR" $R1
    StrCmp $R0 "$PROGRAMFILES64" refuse
    StrLen $R1 "$PROGRAMFILES"
    StrCpy $R0 "$INSTDIR" $R1
    StrCmp $R0 "$PROGRAMFILES" refuse
    Pop $R1
    Pop $R0
    Return
    refuse:
    Pop $R1
    Pop $R0
    Abort
  FunctionEnd
!endif

!macro customInstall
  ; electron-builder keeps a copy of the installer in %LOCALAPPDATA%\<name>-updater for
  ; differential updates. D50: move it into data\updates, where NextLevel's updater keeps its
  ; cache (main/update/updaterAdapter.ts), and leave nothing behind in %LOCALAPPDATA%.
  ${If} ${FileExists} "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
    ${GetParent} "$INSTDIR\data\updates\${APP_INSTALLER_STORE_FILE}" $0
    CreateDirectory "$0"
    CopyFiles /SILENT "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}" "$INSTDIR\data\updates\${APP_INSTALLER_STORE_FILE}"
    Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
    ${GetParent} "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}" $0
    RMDir "$0"
  ${EndIf}
!macroend

!macro customRemoveFiles
  ; Only NextLevel's own files, by name: the folder may also hold another program's files (an
  ; install into an existing emulator folder), so no wildcards. An Electron upgrade that adds a
  ; top-level file must add it here; the packaging smoke test fails on anything left behind.
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\NextLevel.exe"
  Delete "$INSTDIR\Uninstall NextLevel.exe"
  Delete "$INSTDIR\LICENSE.electron.txt"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\dxcompiler.dll"
  Delete "$INSTDIR\dxil.dll"
  Delete "$INSTDIR\electron_wer.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\vulkan-1.dll"
  ; Out of the folder, so it can go when nothing is left (no data\ or Catalog\ to keep).
  SetOutPath $TEMP
  RMDir "$INSTDIR"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${If} ${FileExists} "$INSTDIR\data\*.*"
    ${OrIf} ${FileExists} "$INSTDIR\Catalog\*.*"
      MessageBox MB_OK|MB_ICONINFORMATION "$(nlKeptFolders)" /SD IDOK
    ${EndIf}
  ${endIf}
!macroend

; Numeric ids (1033 English, 1046 Portuguese-Brazil): this file is included before the languages load.
LangString nlKeptFolders 1033 "NextLevel was removed. Your data and Catalog folders were kept in $INSTDIR; delete them yourself if you no longer need them."
LangString nlKeptFolders 1046 "O NextLevel foi removido. As pastas data e Catalog foram mantidas em $INSTDIR; apague-as você mesmo se não precisar mais delas."
