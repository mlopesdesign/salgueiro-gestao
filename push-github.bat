@echo off
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
echo === Push + Tag + Release v3.25.37 ===

git push origin main
git push origin --tags

echo.
echo Criando release no GitHub...
gh release create v3.25.37 "instalador\Salgueiro Gestao Setup v3.25.37.exe" ^
  --title "v3.25.37 — filtro cascata consignado/fornecedor em Produtos e Estoque" ^
  --notes "## v3.25.37 — 2026-09-02^^- Estoque: SELECT cascata — escolha Consignados e depois filtra por fornecedor^^- Produtos: mesma cascata de filtros (prorio / consignado / fornecedor)^^- Remove arquivos soltos da raiz (estoque.js, README.md)"

echo.
echo Pronto!
pause
