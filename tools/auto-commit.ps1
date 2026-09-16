# Salgueiro Gestao - commit automatico da pasta
# Grava um commit sempre que algum arquivo muda, para nada ficar sem versao.
$ErrorActionPreference = 'Continue'
$RAIZ   = 'E:\Projetos\LOJA FISICA SALGUEIRO V2'
$ESPERA = 45
$LOG    = Join-Path $RAIZ 'tools\auto-commit.log'
$PAUSA  = Join-Path $RAIZ 'tools\.pausar-autocommit'

function Log($t) {
  try { Add-Content -Path $LOG -Value ((Get-Date -Format 'dd/MM HH:mm:ss') + '  ' + $t) -Encoding UTF8 } catch {}
}

Set-Location $RAIZ
if (-not (Test-Path (Join-Path $RAIZ '.git'))) { Log 'ERRO: nao e repositorio git'; exit 1 }
Log '=== vigia iniciado ==='

$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path = $RAIZ
$fsw.IncludeSubdirectories = $true
$fsw.NotifyFilter = [IO.NotifyFilters]::FileName -bor [IO.NotifyFilters]::LastWrite
$fsw.EnableRaisingEvents = $true

$script:ultima = [DateTime]::MinValue
$acao = { $script:ultima = Get-Date }
foreach ($ev in 'Changed','Created','Deleted','Renamed') {
  Register-ObjectEvent -InputObject $fsw -EventName $ev -Action $acao | Out-Null
}

while ($true) {
  Start-Sleep -Seconds 10

  # PAUSA: enquanto este arquivo existir, o vigia nao encosta no git.
  # O push-github.bat cria ele antes de commitar/enviar e apaga no fim.
  # Sem isso os dois disputam o .git/HEAD.lock e o commit da release falha
  # com "cannot lock ref HEAD" — foi exatamente o que aconteceu em 16/09/2026.
  if (Test-Path $PAUSA) { continue }

  if ($script:ultima -eq [DateTime]::MinValue) { continue }
  if (((Get-Date) - $script:ultima).TotalSeconds -lt $ESPERA) { continue }
  $script:ultima = [DateTime]::MinValue

  # Nao commitar por cima de um git que ja esta rodando.
  if (Test-Path (Join-Path $RAIZ '.git\index.lock')) { Log 'git ocupado (index.lock) - pulando'; continue }
  if (Test-Path (Join-Path $RAIZ '.git\HEAD.lock'))  { Log 'git ocupado (HEAD.lock) - pulando';  continue }

  $mudou = (git status --porcelain) | Where-Object { $_ }
  if (-not $mudou) { continue }

  $n = ($mudou | Measure-Object).Count
  $nomes = ($mudou | ForEach-Object { ($_ -replace '^..\s+','') } |
            ForEach-Object { Split-Path $_ -Leaf } | Select-Object -First 6) -join ', '
  if ($n -gt 6) { $nomes = $nomes + ' (+' + ($n - 6) + ')' }

  git add -A 2>&1 | Out-Null
  git -c user.name='Auto Commit' -c user.email='auto@mlopesdesign' commit -m ('auto: ' + $nomes) 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Log ("commit " + (git rev-parse --short HEAD) + "  $n arquivo(s): $nomes") }
}
