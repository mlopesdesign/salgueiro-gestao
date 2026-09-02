@echo off
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"
echo === Push + Tag + Release v3.25.38 ===

git push origin main
git push origin --tags

echo.
echo Criando release no GitHub...
gh release create v3.25.38 "Portable\resources.neu" ^
  --title "v3.25.38 — filtro cascata consignado/fornecedor em Estoques (locais) e fix Produtos" ^
  --notes "## v3.25.38 — 2026-09-02^^- Estoques (locais): filtro cascata proprio / consignado / por fornecedor^^- Fix: filtro por fornecedor em Produtos nao funcionava (fornecedor_id ausente na API)"

echo.
echo Pronto!
pause
