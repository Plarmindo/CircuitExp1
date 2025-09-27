; CircuitExp1 NSIS Installer Script
; Enhanced security and user experience

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"

; Security: Request admin privileges only when necessary
RequestExecutionLevel user

; Installer attributes
Name "CircuitExp1"
OutFile "CircuitExp1-Setup.exe"
InstallDir "$LOCALAPPDATA\CircuitExp1"
InstallDirRegKey HKCU "Software\CircuitExp1" "InstallDir"

; Version information
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "CircuitExp1"
VIAddVersionKey "CompanyName" "CircuitExp1 Team"
VIAddVersionKey "LegalCopyright" "Copyright © 2025 CircuitExp1"
VIAddVersionKey "FileDescription" "CircuitExp1 Installer"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0"

; Modern UI configuration
!define MUI_ABORTWARNING
!define MUI_ICON "icon.png"
!define MUI_UNICON "icon.png"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "welcome.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Security: Check Windows version
Function .onInit
  ; Check if Windows 10 or later
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "CircuitExp1 requires Windows 10 or later."
    Abort
  ${EndIf}

  ; Check if already running
  System::Call 'kernel32::CreateMutex(p 0, b 0, t "CircuitExp1Installer") p .r1 ?e'
  Pop $R0
  StrCmp $R0 0 +3
    MessageBox MB_OK|MB_ICONEXCLAMATION "The installer is already running."
    Abort
FunctionEnd

; Installation sections
Section "CircuitExp1 (required)" SecMain
  SectionIn RO

  ; Set output path
  SetOutPath "$INSTDIR"

  ; Install main application files
  File /r "${BUILD_RESOURCES_DIR}\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry entries
  WriteRegStr HKCU "Software\CircuitExp1" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\CircuitExp1" "Version" "${VERSION}"

  ; Add/Remove Programs entry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "DisplayName" "CircuitExp1"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "DisplayIcon" "$INSTDIR\CircuitExp1.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "Publisher" "CircuitExp1 Team"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "NoRepair" 1

  ; Calculate installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1" "EstimatedSize" "$0"
SectionEnd

Section "Desktop Shortcut" SecDesktop
  CreateShortcut "$DESKTOP\CircuitExp1.lnk" "$INSTDIR\CircuitExp1.exe" "" "$INSTDIR\CircuitExp1.exe" 0
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\CircuitExp1"
  CreateShortcut "$SMPROGRAMS\CircuitExp1\CircuitExp1.lnk" "$INSTDIR\CircuitExp1.exe" "" "$INSTDIR\CircuitExp1.exe" 0
  CreateShortcut "$SMPROGRAMS\CircuitExp1\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
SectionEnd

Section "File Associations" SecFileAssoc
  ; Register file associations for project files
  WriteRegStr HKCU "Software\Classes\.circuitexp1" "" "CircuitExp1.Project"
  WriteRegStr HKCU "Software\Classes\CircuitExp1.Project" "" "CircuitExp1 Project File"
  WriteRegStr HKCU "Software\Classes\CircuitExp1.Project\DefaultIcon" "" "$INSTDIR\CircuitExp1.exe,0"
  WriteRegStr HKCU "Software\Classes\CircuitExp1.Project\shell\open\command" "" '"$INSTDIR\CircuitExp1.exe" "%1"'
SectionEnd

Section "Context Menu Integration" SecContextMenu
  ; Add "Analyze with CircuitExp1" to folder context menu
  WriteRegStr HKCU "Software\Classes\Directory\shell\CircuitExp1" "" "Analyze with CircuitExp1"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CircuitExp1" "Icon" "$INSTDIR\CircuitExp1.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CircuitExp1\command" "" '"$INSTDIR\CircuitExp1.exe" "--scan" "%1"'

  ; Add to directory background context menu
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CircuitExp1" "" "Analyze current folder with CircuitExp1"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CircuitExp1" "Icon" "$INSTDIR\CircuitExp1.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\CircuitExp1\command" "" '"$INSTDIR\CircuitExp1.exe" "--scan" "%V"'
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "Core CircuitExp1 application files (required)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create a desktop shortcut for easy access"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Add CircuitExp1 to the Start Menu"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFileAssoc} "Associate .circuitexp1 project files with the application"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecContextMenu} "Add 'Analyze with CircuitExp1' to folder context menus"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; Uninstaller
Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  Delete "$DESKTOP\CircuitExp1.lnk"
  RMDir /r "$SMPROGRAMS\CircuitExp1"

  ; Remove registry entries
  DeleteRegKey HKCU "Software\CircuitExp1"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CircuitExp1"

  ; Remove file associations
  DeleteRegKey HKCU "Software\Classes\.circuitexp1"
  DeleteRegKey HKCU "Software\Classes\CircuitExp1.Project"

  ; Remove context menu entries
  DeleteRegKey HKCU "Software\Classes\Directory\shell\CircuitExp1"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\CircuitExp1"

  ; Clean up empty registry keys
  DeleteRegKey /ifempty HKCU "Software\Classes\Directory\shell"
  DeleteRegKey /ifempty HKCU "Software\Classes\Directory\Background\shell"
SectionEnd

; Security: Verify digital signature on install
Function VerifySignature
  ; This function would verify the installer's digital signature
  ; Implementation depends on specific security requirements
FunctionEnd

; Custom page for security notice
Function SecurityNoticePage
  !insertmacro MUI_HEADER_TEXT "Security Notice" "Important security information"

  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 40u "CircuitExp1 respects your privacy and security. This application:"
  Pop $1

  ${NSD_CreateLabel} 10u 45u 90% 15u "• Only accesses files you explicitly choose to analyze"
  Pop $2

  ${NSD_CreateLabel} 10u 65u 90% 15u "• Does not send any data to external servers"
  Pop $3

  ${NSD_CreateLabel} 10u 85u 90% 15u "• Stores all data locally on your computer"
  Pop $4

  ${NSD_CreateLabel} 10u 105u 90% 15u "• Uses industry-standard security practices"
  Pop $5

  nsDialogs::Show
FunctionEnd

; Post-installation tasks
Function .onInstSuccess
  ; Optional: Check for updates
  ; Optional: Register with Windows Security Center
  ; Optional: Create initial configuration
FunctionEnd

; Pre-uninstall checks
Function un.onInit
  ; Check if application is running
  FindWindow $0 "" "CircuitExp1"
  StrCmp $0 0 continueUninstall
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "CircuitExp1 is currently running. Please close it before uninstalling." IDOK tryAgain IDCANCEL abortUninstall

    tryAgain:
    FindWindow $0 "" "CircuitExp1"
    StrCmp $0 0 continueUninstall
    MessageBox MB_OK|MB_ICONSTOP "Please close CircuitExp1 and try again."
    Abort

    abortUninstall:
    Abort

  continueUninstall:
FunctionEnd
