@echo off
rem Salgueiro Gestao - publica a versao que o Claude deixou na fila.
rem Combinado com o Marcio em 25/09/2026: dois cliques aqui e aguardar.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\auto-commit.ps1" -UmaVez
