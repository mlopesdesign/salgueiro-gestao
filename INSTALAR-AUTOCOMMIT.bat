@echo off
chcp 65001 >nul
title Salgueiro - instalar commit automatico
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"

echo === Criando o checkpoint de agora ===
git add -A
git -c user.name="Auto Commit" -c user.email="auto@mlopesdesign" commit -m "checkpoint antes de ligar o commit automatico"

echo.
echo === Registrando a tarefa que roda sozinha ao ligar o PC ===
schtasks /delete /tn "SalgueiroAutoCommit" /f >nul 2>&1
schtasks /create /tn "SalgueiroAutoCommit" /sc onlogon /rl limited /f ^
  /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"E:\Projetos\LOJA FISICA SALGUEIRO V2\tools\auto-commit.ps1\""

echo.
echo === Ligando agora, sem esperar reiniciar ===
schtasks /run /tn "SalgueiroAutoCommit"

echo.
echo Pronto. A partir de agora toda alteracao na pasta vira commit sozinha,
echo 45 segundos depois da ultima gravacao.
echo O que aconteceu fica em tools\auto-commit.log
echo.
echo Para desligar:  schtasks /end /tn "SalgueiroAutoCommit"
echo Para remover:   schtasks /delete /tn "SalgueiroAutoCommit" /f
pause
