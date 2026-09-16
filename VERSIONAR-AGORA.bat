@echo off
chcp 65001 >nul
title Salgueiro - versionar agora
cd /d "E:\Projetos\LOJA FISICA SALGUEIRO V2"

echo === O que mudou ===
git status --short

echo.
echo === Gravando commit e tag da v3.26.0 ===
git add -A
git -c user.name="Auto Commit" -c user.email="auto@mlopesdesign" commit -m "v3.26.0 - estoque pela grade do produto, etiqueta das pecas que entraram, venda nao deixa saldo negativo, tela de estoque agrupada por produto"
git tag -f v3.26.0

echo.
echo === Historico ===
git log --oneline -8

echo.
echo Pronto. Agora existe ponto de retorno.
echo Para voltar esta versao inteira:  git reset --hard v3.25.41
pause
