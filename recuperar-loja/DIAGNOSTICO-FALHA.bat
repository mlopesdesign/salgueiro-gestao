@echo off
title Diagnostico do Salgueiro Gestao
echo.
echo   Juntando informacoes para descobrir por que o sistema falhou...
echo   (so leitura - nada e alterado neste computador)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnostico-falha.ps1"
echo.
pause
