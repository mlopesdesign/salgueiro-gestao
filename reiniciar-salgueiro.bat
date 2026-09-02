@echo off
taskkill /F /IM "Salgueiro Gestao.exe" 2>nul
timeout /t 1 /nobreak >nul
start "" "C:\Users\Laptop Marcio\AppData\Local\SalgueiroGestao\Salgueiro Gestao.exe"
