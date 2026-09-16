@echo off
chcp 65001 >nul
setlocal
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
title Salgueiro - publicar release
set "VERSAO=3.26.5"
set "TAG=v%VERSAO%"

rem ============================================================
rem  1. PAUSAR o commit automatico.
rem     Ele commita sozinho a cada 45s e segurava o .git/HEAD.lock
rem     bem na hora do commit da release -> "cannot lock ref HEAD".
rem     Era o vigia brigando com este script. (corrigido em 16/09/2026)
rem ============================================================
echo. > "tools\.pausar-autocommit"
schtasks /end /tn "SalgueiroAutoCommit" >nul 2>&1
timeout /t 2 /nobreak >nul

rem  Locks orfaos de um git que morreu no meio
if exist ".git\HEAD.lock"  del /f /q ".git\HEAD.lock"  >nul 2>&1
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
git config core.safecrlf false >nul 2>&1

echo === O que mudou ===
git status --short
echo.

echo === Commit ===
git add -A
git -c user.name="ML Lopes Design" -c user.email="mlopesdesign@gmail.com" commit -m "%TAG% - estoque pelo produto, etiquetas, impressao em rede, tela alinhada"
if errorlevel 1 echo (nada novo para commitar - seguindo)

rem ============================================================
rem  2. Sincronizar com o remoto ANTES de enviar.
rem     "main -> main (non-fast-forward)" = o GitHub tem commits que
rem     este PC nao tem. Sem o rebase, o push e sempre recusado.
rem ============================================================
echo.
echo === Sincronizando com o GitHub ===
git pull --rebase origin main
if errorlevel 1 goto :erro_pull

echo.
echo === Enviando ===
git push origin main
if errorlevel 1 goto :erro_push
git tag -f %TAG%
git push origin %TAG% --force
if errorlevel 1 goto :erro_push

rem ============================================================
rem  3. Release: cria se nao existir, atualiza o arquivo se existir.
rem ============================================================
echo.
echo === Publicando a release ===
gh release view %TAG% >nul 2>&1
if errorlevel 1 (
  gh release create %TAG% "Portable\resources.neu" --title "%TAG% - Estoque pelo produto, etiquetas e tela alinhada" --notes-file "release-notes.md"
  if errorlevel 1 goto :erro_release
  echo Release criada.
) else (
  echo A release %TAG% ja existe - atualizando o arquivo e as notas.
  gh release upload %TAG% "Portable\resources.neu" --clobber
  if errorlevel 1 goto :erro_release
  gh release edit %TAG% --notes-file "release-notes.md" >nul
  echo Arquivo e notas atualizados.
)

echo.
echo ============================================
echo  PRONTO. Codigo versionado e release no ar.
echo  O app instalado vai oferecer a atualizacao.
echo ============================================
goto :fim

:erro_pull
echo.
echo FALHOU ao sincronizar com o GitHub.
echo Se aparecer conflito, manda esta tela para o Claude - NAO continue sozinho.
goto :fim

:erro_push
echo.
echo FALHOU ao enviar. Causas comuns: sem internet, ou o git pedindo login.
goto :fim

:erro_release
echo.
echo FALHOU na release. Causas comuns: o gh nao esta logado (rode: gh auth login).
goto :fim

:fim
rem  Religa o commit automatico, aconteca o que acontecer
if exist "tools\.pausar-autocommit" del /f /q "tools\.pausar-autocommit" >nul 2>&1
schtasks /run /tn "SalgueiroAutoCommit" >nul 2>&1
echo.
pause
