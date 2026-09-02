@echo off
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
echo === Push + Tag + Release v3.25.37 ===

git push origin main
git push origin --tags

echo.
echo Criando release no GitHub...
gh release create v3.25.37 "Portable\resources.neu" ^
  --title "v3.25.37 — filtro cascata consignado/fornecedor em Produtos e Estoque" ^
  --notes "## v3.25.37 — 2026-09-02^^- Estoque: filtro cascata — proprio / consignado / por fornecedor^^- Produtos: mesmo filtro cascata"

echo.
echo Pronto!
pause
