$proj = $PSScriptRoot
Set-Location $proj

# Remove lock travado
$lock = Join-Path $proj ".git\index.lock"
if (Test-Path $lock) { Remove-Item $lock -Force; Write-Host "lock removido" }

# Stage tudo
git add -A
if ($LASTEXITCODE -ne 0) { Write-Error "git add falhou"; exit 1 }
Write-Host "add OK — $(git diff --cached --stat | Measure-Object -Line | Select-Object -ExpandProperty Lines) linhas staged"

# Commit
$msg = @"
v3.25.35/36 — fixes OOM, descontos, PDV, estoque consignado; limpeza

v3.25.35: Fix OOM migracao fotos; desconto avista c/ taxa; custo bloqueia desc categoria; scroll PDV; variacao soft-delete re-adicionavel
v3.25.36: Filtros por fornecedor consignado no Estoque; badge fornecedor na lista
Limpeza: legado/ e _chat-v3.0.0/ removidos; instaladores antigos arquivados; gitignore atualizado

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DKC1RMWnNxXa4jEKHwcxFu
"@
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Write-Error "git commit falhou"; exit 1 }
Write-Host "commit OK"

# Pull rebase
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { Write-Error "git pull falhou — pode ter conflito"; exit 1 }
Write-Host "pull OK"

# Push
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Error "git push falhou"; exit 1 }
Write-Host "push OK — GitHub atualizado"
