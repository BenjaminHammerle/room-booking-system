; ==============================================
; Room Booking System - Inno Setup Installer
; ==============================================

[Setup]
AppName=Room Booking System
AppVersion=0.1.0
DefaultDirName={pf}\RoomBookingSystem
DefaultGroupName=Room Booking System
OutputDir=.
OutputBaseFilename=RoomBookingSystem-Setup
Compression=lzma
SolidCompression=yes
DisableProgramGroupPage=no

; Icon für Installer-Fenster
SetupIconFile=..\scripts\icon.ico

; Icon in "Programme & Features"
UninstallDisplayIcon={app}\scripts\icon.ico

[Files]
; Alles aus dem Projekt kopieren
Source: "..\*"; DestDir: "{app}"; Flags: recursesubdirs

; Icon explizit mitinstallieren (Sicherheit)
Source: "..\scripts\icon.ico"; DestDir: "{app}\scripts"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknuepfung erstellen"; GroupDescription: "Zusaetzliche Optionen:"; Flags: unchecked

[Icons]
; Startmenü
Name: "{group}\Room Booking System"; Filename: "{app}\scripts\start.bat"; IconFilename: "{app}\scripts\icon.ico"
Name: "{group}\Uninstall Room Booking System"; Filename: "{uninstallexe}"

; Desktop (optional über Task)
Name: "{commondesktop}\Room Booking System"; Filename: "{app}\scripts\start.bat"; IconFilename: "{app}\scripts\icon.ico"; Tasks: desktopicon

[Run]
; Node.js Check
Filename: "cmd.exe"; Parameters: "/c node --version"; StatusMsg: "Pruefe Node.js..."; Flags: runhidden waituntilterminated; Check: NodeInstalled

; npm install
Filename: "cmd.exe"; Parameters: "/c npm install"; WorkingDir: "{app}"; StatusMsg: "Installiere Abhaengigkeiten..."; Flags: waituntilterminated

; Build
Filename: "cmd.exe"; Parameters: "/c npm run build"; WorkingDir: "{app}"; StatusMsg: "Baue Anwendung..."; Flags: waituntilterminated

; Start App nach Installation
Filename: "{app}\scripts\start.bat"; Description: "Starte Room Booking System"; Flags: nowait postinstall skipifsilent

[Code]
function NodeInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
  if not Result then
    MsgBox(
      'Node.js (Version 20 LTS) ist nicht installiert.'#13#10 +
      'Bitte installiere Node.js von https://nodejs.org',
      mbError, MB_OK);
end;
