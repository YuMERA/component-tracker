; ============================================================================
;  Component Tracker – Windows instalacija (po uzoru na Šank: sankapp.iss)
; ----------------------------------------------------------------------------
;  Pravi se sa:  npm run build:setup   (ne pokretati ISCC ručno – skripta prvo
;  napravi ComponentTracker.exe i preda verziju)
;
;  Šta instalacija uradi:
;    1. program u  C:\Program Files\ComponentTracker   (samo za čitanje)
;    2. podaci u   C:\ProgramData\ComponentTracker     (baza, slike, datasheet-ovi, backup-i)
;    3. servis "Component Tracker" – pali se sa računarom, sam se podiže ako padne
;    4. pravilo u Windows zaštitnom zidu – da telefon u lokalnoj mreži može da otvori aplikaciju
;    5. ikonica "Component Tracker" na radnoj površini i u Start meniju
;
;  Deinstalacija skida 1, 3, 4 i 5. Folder sa podacima OSTAJE – baza se nikad
;  ne briše programom za deinstalaciju.
;
;  Nadogradnja (nov setup preko starog): servis se zaustavi, baza se kopira
;  u backups\ pre nego što se išta dira, pa se servis ponovo pokrene.
; ============================================================================

#ifndef AppVer
  #define AppVer "0.0.0"
#endif

#define AppName "Component Tracker"
#define Exe "ComponentTracker.exe"
#define Service "ComponentTracker-service.exe"
#define DataDir "{commonappdata}\ComponentTracker"

[Setup]
AppId={{9E3C2B71-4A6D-4F0E-8C5B-2D7A1E6F3B94}
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher=mera-system
AppPublisherURL=https://mera-system.com
AppCopyright=© mera-system
DefaultDirName={autopf}\ComponentTracker
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=ComponentTracker-setup-{#AppVer}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=component-tracker.ico
UninstallDisplayIcon={app}\component-tracker.ico
UninstallDisplayName={#AppName}
CloseApplications=no
; uvek ponudi izbor jezika (auto pita samo kad jezik Windows-a nije ni sr ni en);
; unapred je izabran jezik Windows-a
ShowLanguageDialog=yes

[Languages]
Name: "sr"; MessagesFile: "SerbianLatin.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
sr.OpenApp=Otvori Component Tracker
en.OpenApp=Open Component Tracker
sr.DataFolder=Folder sa podacima
en.DataFolder=Data folder
sr.Uninstall=Deinstaliraj Component Tracker
en.Uninstall=Uninstall Component Tracker
sr.RegService=Prijavljujem servis...
en.RegService=Registering the service...
sr.StartService=Pokrećem program...
en.StartService=Starting the app...
sr.Firewall=Otvaram pristup iz lokalne mreže (telefon)...
en.Firewall=Allowing access from the local network (phone)...
sr.BackupFailed=Nije uspelo kopiranje baze pre nadogradnje. Ništa nije promenjeno – pokušajte ponovo.
en.BackupFailed=Could not back up the database before upgrading. Nothing was changed – please try again.

[Messages]
sr.FinishedLabel=Component Tracker je instaliran i već radi.%n%nOtvara se ikonicom „Component Tracker” na radnoj površini, ili u pregledaču na adresi http://localhost:3000%n%nPodaci su u C:\ProgramData\ComponentTracker
en.FinishedLabel=Component Tracker is installed and already running.%n%nOpen it with the "Component Tracker" desktop icon, or in a browser at http://localhost:3000%n%nData is stored in C:\ProgramData\ComponentTracker

[Dirs]
; Servis radi kao sistem, a ikonica (kad servis ne radi) kao običan korisnik – oba moraju da pišu
Name: "{#DataDir}"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#DataDir}\backups"; Flags: uninsneveruninstall

[Files]
Source: "..\release\ComponentTracker\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "winsw\WinSW.NET461.exe"; DestDir: "{app}"; DestName: "{#Service}"; Flags: ignoreversion
Source: "ComponentTracker-service.xml"; DestDir: "{app}"; Flags: ignoreversion
Source: "component-tracker.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#Exe}"; Parameters: "--open"; WorkingDir: "{app}"; IconFilename: "{app}\component-tracker.ico"; Comment: "{cm:OpenApp}"
Name: "{commonprograms}\{#AppName}\{#AppName}"; Filename: "{app}\{#Exe}"; Parameters: "--open"; WorkingDir: "{app}"; IconFilename: "{app}\component-tracker.ico"
Name: "{commonprograms}\{#AppName}\{cm:DataFolder}"; Filename: "{#DataDir}"
Name: "{commonprograms}\{#AppName}\{cm:Uninstall}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#Service}"; Parameters: "install"; Flags: runhidden waituntilterminated; StatusMsg: "{cm:RegService}"
Filename: "{app}\{#Service}"; Parameters: "start"; Flags: runhidden waituntilterminated; StatusMsg: "{cm:StartService}"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#AppName}"""; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""{#AppName}"" dir=in action=allow program=""{app}\{#Exe}"" enable=yes profile=private,domain"; Flags: runhidden waituntilterminated; StatusMsg: "{cm:Firewall}"
Filename: "{app}\{#Exe}"; Parameters: "--open"; Description: "{cm:OpenApp}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\{#Service}"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\{#Service}"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#Exe}"; Flags: runhidden waituntilterminated; RunOnceId: "KillApp"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#AppName}"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveFirewall"

[Code]
{ Nadogradnja: pre kopiranja fajlova ugasi stari program i sačuvaj bazu. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Rc: Integer;
  Data, Copy: String;
begin
  Result := '';

  if FileExists(ExpandConstant('{app}\{#Service}')) then
    Exec(ExpandConstant('{app}\{#Service}'), 'stop', '', SW_HIDE, ewWaitUntilTerminated, Rc);

  { Primerak koji je ikonica pokrenula mimo servisa }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#Exe}', '', SW_HIDE, ewWaitUntilTerminated, Rc);

  Data := ExpandConstant('{#DataDir}');
  if FileExists(Data + '\inventory.db') then
  begin
    ForceDirectories(Data + '\backups');
    Copy := Data + '\backups\inventory-before-upgrade-' + GetDateTimeString('yyyy-mm-dd-hhnnss', '-', '-');
    if not FileCopy(Data + '\inventory.db', Copy + '.db', False) then
    begin
      Result := CustomMessage('BackupFailed');
      Exit;
    end;
    if FileExists(Data + '\inventory.db-wal') then
      FileCopy(Data + '\inventory.db-wal', Copy + '.db-wal', False);
  end;
end;
