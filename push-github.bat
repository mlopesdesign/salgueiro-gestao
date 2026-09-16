@echo off
chcp 65001 >nul
setlocal
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
title Salgueiro - publicar release

rem ============================================================
rem  1. Destravar o git se sobrou lock de um processo morto.
rem     "cannot lock ref HEAD: HEAD.lock: File exists" acontece
rem     quando um git anterior foi fechado no meio. O arquivo fica
rem     para tras e trava TODOS os comandos seguintes.
rem ============================================================
if exist ".git\HEAD.lock"  del /f /q ".git\HEAD.lock"  >nul 2>&1
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

rem Silencia o aviso de LF/CRLF, que enche a tela e nao e erro.
git config core.safecrlf false >nul 2>&1

rem ============================================================
rem  2. Commit automatico da pasta, SEM precisar de administrador.
rem     Antes isto usava `schtasks /sc onlogon`, que exige elevacao
rem     e dava "Acesso negado". Agora e um atalho na pasta Inicializar
rem     do proprio usuario: sobe junto com o Windows, sem UAC.
rem ============================================================
set "INICIALIZAR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%INICIALIZAR%\SalgueiroAutoCommit.lnk" (
  echo === Ligando o commit automatico da pasta ===
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%INICIALIZAR%\SalgueiroAutoCommit.lnk');" ^
    "$s.TargetPath='powershell.exe';" ^
    "$s.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"E:\Projetos\LOJA FISICA SALGUEIRO V2\tools\auto-commit.ps1\"';" ^
    "$s.WorkingDirectory='E:\Projetos\LOJA FISICA SALGUEIRO V2';" ^
    "$s.WindowStyle=7; $s.Save()"
  if exist "%INICIALIZAR%\SalgueiroAutoCommit.lnk" (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "E:\Projetos\LOJA FISICA SALGUEIRO V2\tools\auto-commit.ps1"
    echo Commit automatico ligado. Registro em tools\auto-commit.log
  ) else (
    echo AVISO: nao consegui ligar o commit automatico. O resto continua normal.
  )
  echo.
)

rem ============================================================
rem  3. Commit, tag, envio e release
rem ============================================================
echo === O que mudou ===
git status --short
echo.

echo === Commit e tag da v3.26.5 ===
git add -A
git -c user.name="ML Lopes Design" -c user.email="mlopesdesign@gmail.com" commit -m "v3.26.5 - estoque pelo produto, etiquetas, impressao em rede, tela alinhada e responsiva"
if errorlevel 1 echo (nada novo para commitar - seguindo)
git tag -f v3.26.5
if errorlevel 1 goto :erro_git

echo.
echo === Enviando para o GitHub ===
git push origin main
if errorlevel 1 goto :erro_push
git push origin v3.26.5 --force
if errorlevel 1 goto :erro_push

echo.
echo === Publicando a release ===
gh release create v3.26.5 "Portable\resources.neu" ^
  --title "v3.26.5 - Estoque pelo produto, etiquetas e tela alinhada" ^
  --notes-file "release-notes.md"
if errorlevel 1 goto :erro_release

echo.
echo ============================================
echo  PRONTO. Release publicada.
echo  O app instalado vai oferecer a atualizacao.
echo ============================================
goto :fim

:erro_git
echo.
echo FALHOU no git (tag/commit). Manda esta tela para o Claude.
goto :fim

:erro_push
echo.
echo FALHOU ao enviar. Causas comuns: sem internet, ou o git pedindo login.
echo Manda esta tela para o Claude.
goto :fim

:erro_release
echo.
echo FALHOU ao publicar a release. Causas comuns:
echo   - o gh nao esta logado  ..:  rode  gh auth login
echo   - a tag v3.26.5 ja tem release publicada
echo Manda esta tela para o Claude.
goto :fim

:fim
echo.
pause
