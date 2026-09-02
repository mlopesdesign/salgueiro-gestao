@echo off
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
echo === Push + Tag + Release v3.25.36 ===

git push origin main
git push origin --tags

echo.
echo Criando release no GitHub...
gh release create v3.25.36 "instalador\Salgueiro Gestao Setup v3.25.36.exe" ^
  --title "v3.25.36 — Estoque: filtros consignado por fornecedor" ^
  --notes "## v3.25.36 — 2026-09-02^^- Filtros por fornecedor consignado no Estoque^^- Badge do fornecedor visível em cada produto consignado na lista de estoque"

echo.
echo Pronto!
pause
