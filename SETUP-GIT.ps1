# Salgueiro Gestao V2 — Setup Git + GitHub
# Execute: botao direito no arquivo → "Executar com PowerShell"
# Feito por ML Lopes Design — rodar UMA UNICA VEZ no computador principal

$ErrorActionPreference = "Stop"
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=== Salgueiro Gestao V2 — Configuracao Git ===" -ForegroundColor Cyan
Write-Host "Pasta: $pasta"
Write-Host ""

# 1. Verificar se git esta instalado
try {
    $gitVer = git --version 2>&1
    Write-Host "Git encontrado: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Git nao esta instalado." -ForegroundColor Red
    Write-Host "Instale em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Depois de instalar, execute este script novamente." -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit 1
}

# 2. Remover .git corrompido se existir (criado pelo sandbox do Claude)
$gitDir = Join-Path $pasta ".git"
if (Test-Path $gitDir) {
    Write-Host "Removendo .git anterior (setup incompleto)..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $gitDir
    Write-Host "Removido." -ForegroundColor Green
}

# 3. Inicializar repositorio
Set-Location $pasta
git init
git branch -M main
git config user.name "ML Lopes Design"
git config user.email "mlopesdesign@gmail.com"
Write-Host "Repositorio inicializado." -ForegroundColor Green

# 4. Stage e commit inicial
git add -A
git commit -m "v2.8.0 — commit inicial do projeto Salgueiro Gestao V2"
Write-Host ""
Write-Host "Commit inicial criado." -ForegroundColor Green

# 5. Instrucoes para GitHub
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "PROXIMOS PASSOS — siga na ordem:" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Abra https://github.com/new no navegador"
Write-Host "   - Repository name: salgueiro-gestao-v2"
Write-Host "   - Visibilidade: Private (recomendado)"
Write-Host "   - NAO marque nenhuma opcao de inicializacao"
Write-Host "   - Clique em 'Create repository'"
Write-Host ""
Write-Host "2. Copie a URL do repositorio (ex: https://github.com/mlopesdesign/salgueiro-gestao-v2.git)"
Write-Host ""
Write-Host "3. Neste terminal, cole e execute (substitua a URL pela sua):"
Write-Host ""
Write-Host "   git remote add origin https://github.com/SEU-USUARIO/salgueiro-gestao-v2.git" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. No SEGUNDO computador, execute:"
Write-Host ""
Write-Host "   git clone https://github.com/SEU-USUARIO/salgueiro-gestao-v2.git" -ForegroundColor Yellow
Write-Host "   'D:\Projetos\LOJA FISICA SALGUEIRO V2'" -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "FLUXO DO DIA A DIA:"
Write-Host "  Antes de editar:  git pull"
Write-Host "  Apos editar:      git add -A && git commit -m 'descricao' && git push"
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Pressione Enter para fechar"
