@echo off
chcp 65001 >nul
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"

echo === Enviando commits e tags ===
git push origin main
git push origin v3.25.39 --force
git push origin v3.25.40 --force

echo.
echo === Criando release v3.25.40 ===
gh release create v3.25.40 "Portable\resources.neu" ^
  --title "v3.25.40 — troca rapida sem venda de origem; importacao de vendas do WhatsApp por planilha" ^
  --notes-file "release-notes.md"

echo.
echo === Pronto ===
pause
