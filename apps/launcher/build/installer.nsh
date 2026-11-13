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

!macro customRemoveFiles
  Delete "$INSTDIR\NextLevel.exe"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\LICENSE*"
  Delete "$INSTDIR\Uninstall NextLevel.exe"
  ; Removed only when empty, i.e. when there is no data\ or Catalog\ left to keep.
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
