; Salgueiro Gestao v2.7.0
; Os arquivos são preparados em /tmp/rel pelo pipeline de build (ver CLAUDE.md).
Unicode True

Name "Salgueiro Gestao 2.7.0"
OutFile "/tmp/Salgueiro Gestao Setup.exe"
InstallDir "$LOCALAPPDATA\SalgueiroGestao"
RequestExecutionLevel user
; zlib em vez de lzma: o LZMA sólido leva mais de 60s e o sandbox mata o
; processo antes de terminar, gerando um Setup truncado. zlib compila em ~8s.
; Custo: o instalador fica ~3 MB maior (15,3 MB contra 12,1 MB).
SetCompressor /SOLID zlib

Icon "/tmp/rel/icon.ico"
UninstallIcon "/tmp/rel/icon.ico"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Principal"
  SetOutPath "$INSTDIR"
  File "/oname=Salgueiro Gestao.exe" "/tmp/rel/salgueiro.exe"
  File "/tmp/rel/resources.neu"
  File "/oname=icon.ico" "/tmp/rel/icon.ico"

  SetOutPath "$INSTDIR\extensions\rede"
  File "/tmp/rel/extensions/rede/servidor-rede.ps1"
  File "/tmp/rel/extensions/rede/SumatraPDF.exe"

  SetOutPath "$INSTDIR"
  CreateShortcut "$DESKTOP\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\Salgueiro Gestao.exe" 0
  CreateDirectory "$SMPROGRAMS\Salgueiro Gestao"
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\Salgueiro Gestao.exe" 0
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Desinstalar.lnk" "$INSTDIR\uninstall.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayName" "Salgueiro Gestao"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion" "2.7.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "Publisher" "ML Lopes Design"

  ExecShell "open" "powershell.exe" "-NoProfile -WindowStyle Hidden -Command netsh advfirewall firewall add rule name=SalgueiroRede dir=in action=allow protocol=TCP localport=8750"
SectionEnd

Section "Uninstall"
  ExecShell "open" "powershell.exe" "-NoProfile -WindowStyle Hidden -Command netsh advfirewall firewall delete rule name=SalgueiroRede"

  Delete "$DESKTOP\Salgueiro Gestao.lnk"
  Delete "$SMPROGRAMS\Salgueiro Gestao\Salgueiro Gestao.lnk"
  Delete "$SMPROGRAMS\Salgueiro Gestao\Desinstalar.lnk"
  RMDir  "$SMPROGRAMS\Salgueiro Gestao"
  Delete "$INSTDIR\Salgueiro Gestao.exe"
  Delete "$INSTDIR\resources.neu"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\extensions\rede\servidor-rede.ps1"
  Delete "$INSTDIR\extensions\rede\SumatraPDF.exe"
  RMDir  "$INSTDIR\extensions\rede"
  RMDir  "$INSTDIR\extensions"
  Delete "$INSTDIR\uninstall.exe"
  RMDir  "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
SectionEnd
