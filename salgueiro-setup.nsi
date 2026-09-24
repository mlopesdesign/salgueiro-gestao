; Salgueiro Gestao v3.27.0
; Build: /tmp/rel  — gerado pelo pipeline de build (ver CLAUDE.md)
Unicode True
!include "LogicLib.nsh"

Name "Salgueiro Gestao"
OutFile "/tmp/Salgueiro Gestao Setup v3.27.0.exe"
InstallDir "$LOCALAPPDATA\SalgueiroGestao"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID zlib

Icon "/tmp/rel/icon.ico"
UninstallIcon "/tmp/rel/icon.ico"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

; ---------------------------------------------------------------------------
; DETECCAO DE VERSAO ANTERIOR
;   $R0 = UninstallString (HKCU)   $R1 = DisplayVersion   $R2 = achou? (1/0)
;   $R3 = pasta de instalacao detectada
; Checa, nesta ordem, TODAS as pistas possiveis. Qualquer uma -> pergunta.
; ---------------------------------------------------------------------------
Function .onInit
  StrCpy $R2 "0"
  StrCpy $R1 ""
  StrCpy $R3 "$LOCALAPPDATA\SalgueiroGestao"

  ; 1) Registro HKCU — chave sem espaco
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString"
  ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion"
  ReadRegStr $R4 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "InstallLocation"
  ${If} $R0 != ""
    StrCpy $R2 "1"
    ${If} $R4 != ""
      StrCpy $R3 $R4
    ${EndIf}
  ${EndIf}

  ; 2) Registro HKCU — chave COM espaco (instalacoes antigas)
  ${If} $R2 == "0"
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao" "UninstallString"
    ReadRegStr $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao" "DisplayVersion"
    ${If} $R0 != ""
      StrCpy $R2 "1"
    ${EndIf}
  ${EndIf}

  ; 3) Registro HKLM (instalacoes feitas como administrador)
  ${If} $R2 == "0"
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString"
    ReadRegStr $R1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion"
    ${If} $R0 != ""
      StrCpy $R2 "1"
    ${EndIf}
  ${EndIf}

  ; 4..10) Pistas em disco — LogicLib ${FileExists}, sem salto relativo
  !macro PISTA CAMINHO
    ${If} $R2 == "0"
    ${AndIf} ${FileExists} "${CAMINHO}"
      StrCpy $R2 "1"
    ${EndIf}
  !macroend

  !insertmacro PISTA "$R3\Salgueiro Gestao.exe"
  !insertmacro PISTA "$LOCALAPPDATA\SalgueiroGestao\Salgueiro Gestao.exe"
  !insertmacro PISTA "$LOCALAPPDATA\SalgueiroGestao\resources.neu"
  !insertmacro PISTA "$LOCALAPPDATA\SalgueiroGestao\uninstall.exe"
  !insertmacro PISTA "$LOCALAPPDATA\SalgueiroGestao\.tmp\window_state.config.json"
  !insertmacro PISTA "$LOCALAPPDATA\SalgueiroGestao\*.*"
  !insertmacro PISTA "$DESKTOP\Salgueiro Gestao.lnk"
  !insertmacro PISTA "$SMPROGRAMS\Salgueiro Gestao\*.*"
  !insertmacro PISTA "$APPDATA\SalgueiroGestao\dados\*.*"
  !insertmacro PISTA "$APPDATA\SalgueiroGestao\*.*"

  ; --- Perguntar se achou qualquer pista ---
  ${If} $R2 == "1"
    ${If} $R1 == ""
      StrCpy $R1 "versao anterior"
    ${EndIf}
    MessageBox MB_YESNO|MB_ICONQUESTION "Salgueiro Gestao ($R1) ja esta instalado neste computador.$\n$\nDeseja atualizar para a versao 3.27.0?$\n$\nSeus dados, vendas e configuracoes serao preservados." IDYES prosseguir
    Abort
    prosseguir:
  ${EndIf}

  ; Fechar processo se estiver rodando
  nsExec::Exec 'taskkill /F /IM "Salgueiro Gestao.exe" /T'
  nsExec::Exec 'taskkill /F /IM "salgueiro-gestao.exe" /T'
  Sleep 800

  ; Remover atalhos antigos
  Delete "$DESKTOP\Salgueiro*.lnk"
  Delete "$COMMONDESKTOP\Salgueiro*.lnk"
  Delete "$SMPROGRAMS\Salgueiro Gestao\*.lnk"
  RMDir  "$SMPROGRAMS\Salgueiro Gestao"
  Delete "$SMPROGRAMS\Salgueiro*.lnk"

  ; Desinstalar versao anterior silenciosamente
  ${If} $R0 != ""
    ExecWait '"$R0" /S'
    Sleep 1500
  ${EndIf}

  ; Limpar entradas de registro orfas
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Salgueiro Gestao"
FunctionEnd

Section "Principal"
  ; ===== CRITICO =====
  ; Neutralino grava o estado da janela (tamanho, posicao, maximizada/minimizada)
  ; em .tmp\window_state.config.json DENTRO da pasta do app e o recarrega no boot.
  ; A v3.25.13 gravou um estado quebrado ali, fazendo o app abrir minimizado em
  ; TODAS as versoes seguintes, mesmo reinstalando. Apagar e obrigatorio.
  Delete "$INSTDIR\.tmp\window_state.config.json"
  Delete "$INSTDIR\.tmp\auth_info.json"
  RMDir /r "$INSTDIR\.tmp"
  Delete "$LOCALAPPDATA\SalgueiroGestao\.tmp\window_state.config.json"
  RMDir /r "$LOCALAPPDATA\SalgueiroGestao\.tmp"

  SetOutPath "$INSTDIR"
  File "/oname=Salgueiro Gestao.exe" "/tmp/rel/salgueiro.exe"
  File "/tmp/rel/resources.neu"
  File "/oname=icon.ico" "/tmp/rel/icon.ico"

  SetOutPath "$INSTDIR\extensions\rede"
  File "/tmp/rel/extensions/rede/servidor-rede.ps1"
  File "/tmp/rel/extensions/rede/SumatraPDF.exe"

  SetOutPath "$INSTDIR"

  CreateShortcut "$DESKTOP\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\icon.ico" 0

  CreateDirectory "$SMPROGRAMS\Salgueiro Gestao"
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Salgueiro Gestao.lnk" "$INSTDIR\Salgueiro Gestao.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Salgueiro Gestao\Desinstalar.lnk" "$INSTDIR\uninstall.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayName" "Salgueiro Gestao"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayVersion" "3.27.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "Publisher" "ML Lopes Design"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao" "DisplayIcon" "$INSTDIR\icon.ico"

  ; Regra de firewall - PRECISA DE ADMINISTRADOR.
  ; O instalador roda como usuario comum (RequestExecutionLevel user), entao o
  ; netsh via nsExec FALHA EM SILENCIO e o terminal em rede nunca conecta.
  ; Por isso pedimos elevacao explicita aqui (UAC). Se o cliente recusar, o
  ; DIAGNOSTICO-REDE.bat cria a regra depois.
  ExecShell "runas" "powershell.exe" '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "netsh advfirewall firewall delete rule name=SalgueiroRede; netsh advfirewall firewall add rule name=SalgueiroRede dir=in action=allow protocol=TCP localport=8750 profile=any"' SW_HIDE
  Sleep 1200

  Exec '"$INSTDIR\Salgueiro Gestao.exe"'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'netsh advfirewall firewall delete rule name=SalgueiroRede'

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
  Delete "$INSTDIR\extensions\rede\erro.log"
  RMDir  "$INSTDIR\extensions\rede"
  RMDir  "$INSTDIR\extensions"
  ; Estado da janela — nunca deixar para tras
  RMDir /r "$INSTDIR\.tmp"
  RMDir  "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SalgueiroGestao"
SectionEnd
