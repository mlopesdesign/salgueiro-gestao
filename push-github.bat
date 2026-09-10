@echo off
chcp 65001 >nul
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"

echo === Enviando commits e tags ===
git push origin main
git push origin v3.25.39 --force
git push origin v3.25.40 --force
git push origin v3.25.41 --force

echo.
echo === Criando release v3.25.41 ===
gh release create v3.25.41 "Portable\resources.neu" ^
  --title "v3.25.41 — busca do PDV sem corte: produto novo nao aparecia na tela" ^
  --notes-file "release-notes.md"

echo.
echo === Pronto ===
pause
