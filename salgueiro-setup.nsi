; Salgueiro Gestao v3.25.12
; Build: /tmp/rel  — gerado pelo pipeline de build (ver CLAUDE.md)
Unicode True
!include "LogicLib.nsh"

Name "Salgueiro Gestao"
OutFile "/tmp/Salgueiro Gestao Setup.exe"
InstallDir "$LOCALAPPDATA\SalgueiroGestao"
; Usa diretório da instalação anterior se existir
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID zlib

Icon "/tmp/rel/icon.ico"
UninstallIcon "/tmp/rel/icon.ico"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Function .onInit
  ; Detectar versão anterior e pedir confirmação antes de prosseguir
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString"
  ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion"
  StrCmp $R0 "" sem_instalacao_anterior
  MessageBox MB_YESNO|MB_ICONQUESTION "Salgueiro Gestão $R1 já está instalado.$\n$\nDeseja atualizar para a versão 3.25.12?" IDYES prosseguir
  Abort
  prosseguir:
  sem_instalacao_anterior:

  ; Fechar processo se estiver rodando
  ExecWait 'taskkill /F /IM "Salgueiro Gestao.exe" /T'
  ExecWait 'taskkill /F /IM "salgueiro-gestao.exe" /T'
  Sleep 800

  ; Remover atalhos antigos de qualquer versão anterior (desktop + menu iniciar)
  Delete "$DESKTOP\Salgueiro*.lnk"
  Delete "$COMMONDESKTOP\Salgueiro*.lnk"
  Delete "$SMPROGRAMS\Salgueiro Gestao\*.lnk"
  RMDir  "$SMPROGRAMS\Salgueiro Gestao"
  Delete "$SMPROGRAMS\Salgueiro*.lnk"

  ; Desinstalar versão anterior silenciosamente (HKCU)
  ${If} $R0 != ""
    ExecWait '"$R0" /S'
    Sleep 1500
  ${EndIf}
  ; Também verificar HKLM (instalações antigas feitas como admin)
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString"
  ${If} $R0 != ""
    ExecWait '"$R0" /S'
    Sleep 1500
  ${EndIf}

  ; Limpar entradas de registro órfãs (qualquer variante do nome)
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao"
FunctionEnd

Section "Principal"
  SetOutPath "$INSTDIR"
  File "/oname=Salgueiro Gestao.exe" "/tmp/rel/salgueiro.exe"
  File "/tmp/rel/resources.neu"
  File "/oname=icon.ico" "/tmp/rel/icon.ico"

  SetOutPath "$INSTDIR\extensions\rede"
  File "/tmp/rel/extensions/rede/servidor-rede.ps1"
  File "/tmp/rel/extensions/rede/SumatraPDF.exe"

  SetOutPath "$INSTDIR"

  ; Atalho na Área de Trabalho com ícone explícito
  CreateShortcut "$DESKTOP\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\icon.ico" 0

  ; Atalhos no Menu Iniciar
  CreateDirectory "$SMPROGRAMS\Salgueiro Gestao"
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Desinstalar.lnk" "$INSTDIR\uninstall.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Registro para Programas e Recursos
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayName" "Salgueiro Gestao"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion" "3.25.12"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "Publisher" "ML Lopes Design"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayIcon" "$INSTDIR\icon.ico"

  ; Regra de firewall para modo rede
  ExecShell "open" "powershell.exe" "-NoProfile -WindowStyle Hidden -Command netsh advfirewall firewall add rule name=SalgueiroRede dir=in action=allow protocol=TCP localport=8750"

  ; Abrir o app automaticamente após instalação
  Exec '"$INSTDIR\Salgueiro Gestao.exe"'
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
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\extensions\rede\servidor-rede.ps1"
  Delete "$INSTDIR\extensions\rede\SumatraPDF.exe"
  RMDir  "$INSTDIR\extensions\rede"
  RMDir  "$INSTDIR\extensions"
  RMDir  "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
SectionEnd
