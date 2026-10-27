# Diagnóstico de falha do Salgueiro Gestão (v3.33.2)
# Só LÊ — não altera nada no computador. Junta num .zip na Área de Trabalho:
#  - logs do sistema (app e rede)
#  - lista dos arquivos do banco e das cópias, com tamanho e hora
#  - quedas e desligamentos do Windows (energia, travamento, reinício forçado)
#  - erros de disco e do sistema de arquivos, atualizações do Windows, antivírus
#  - cópias de sombra (Versões Anteriores) que possam ter o banco
$ErrorActionPreference = 'SilentlyContinue'
$agora   = Get-Date
$dias    = 20
$desde   = $agora.AddDays(-$dias)
$base    = Join-Path $env:APPDATA 'SalgueiroGestao'
$saida   = Join-Path $env:TEMP ("diag-salgueiro-" + $agora.ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $saida | Out-Null
$rel     = Join-Path $saida 'RELATORIO.txt'
function Escreve($t) { Add-Content -Path $rel -Value $t -Encoding UTF8 }
function Titulo($t) { Escreve ''; Escreve ('=' * 78); Escreve $t; Escreve ('=' * 78) }

Titulo "DIAGNÓSTICO SALGUEIRO — $($agora.ToString('dd/MM/yyyy HH:mm:ss')) — $env:COMPUTERNAME / $env:USERNAME"
$os = Get-CimInstance Win32_OperatingSystem
Escreve ("Windows: {0} {1} · ligado desde {2}" -f $os.Caption, $os.Version, $os.LastBootUpTime)

# 1. Arquivos do banco
Titulo '1. ARQUIVOS DO BANCO E DAS CÓPIAS'
foreach ($p in @("$base\dados", "$base\dados\backups")) {
  Escreve "--- $p"
  Get-ChildItem -Path $p -File | Sort-Object LastWriteTime |
    ForEach-Object { Escreve ("{0,-70} {1,12:N0} bytes  criado {2:dd/MM/yyyy HH:mm:ss}  alterado {3:dd/MM/yyyy HH:mm:ss}" -f $_.Name, $_.Length, $_.CreationTime, $_.LastWriteTime) }
}
# arquivos de banco inteiros zerados?
Titulo '1b. CONFERÊNCIA DE CONTEÚDO (zerado / cabeçalho SQLite)'
Get-ChildItem -Path "$base\dados", "$base\dados\backups" -File -Filter *.db* | ForEach-Object {
  try {
    $fs = [System.IO.File]::OpenRead($_.FullName); $buf = New-Object byte[] 16; [void]$fs.Read($buf, 0, 16); $fs.Close()
    $cab = [System.Text.Encoding]::ASCII.GetString($buf, 0, 15)
    $estado = if ($cab -eq 'SQLite format 3') { 'ok (SQLite)' } elseif (($buf | Where-Object { $_ -ne 0 }).Count -eq 0) { 'INÍCIO ZERADO' } else { 'cabeçalho estranho' }
    Escreve ("{0,-70} {1}" -f $_.Name, $estado)
  } catch { Escreve ("{0,-70} não deu para ler: {1}" -f $_.Name, $_.Exception.Message) }
}

# 2. Logs do sistema
Titulo '2. LOGS DO SALGUEIRO'
if (Test-Path "$base\logs") {
  Copy-Item -Path "$base\logs" -Destination (Join-Path $saida 'logs') -Recurse -Force
  Get-ChildItem "$base\logs" -File | Sort-Object Name | ForEach-Object { Escreve ("{0,-40} {1,10:N0} bytes" -f $_.Name, $_.Length) }
} else { Escreve 'pasta de logs não encontrada' }

# 3. Quedas e desligamentos
Titulo "3. LIGA/DESLIGA E QUEDAS DO WINDOWS (últimos $dias dias)"
$ids = 41, 6008, 6005, 6006, 1074, 1076, 109, 42, 1, 13, 12, 1001
$fontes = 'Microsoft-Windows-Kernel-Power|EventLog|User32|Microsoft-Windows-Power-Troubleshooter|Microsoft-Windows-Kernel-General|Microsoft-Windows-WER-SystemErrorReporting|BugCheck'
Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = $ids; StartTime = $desde } |
  Where-Object { $_.ProviderName -match "^($fontes)$" } |
  Sort-Object TimeCreated |
  ForEach-Object {
    $o = switch ($_.Id) {
      41   { 'QUEDA: reiniciou sem desligar direito (energia/travamento)' }
      6008 { 'QUEDA: o desligamento anterior foi inesperado' }
      6005 { 'Windows ligou' }
      6006 { 'Windows desligou normalmente' }
      1074 { 'desligamento/reinício pedido por programa ou usuário' }
      1076 { 'motivo do desligamento inesperado informado' }
      109  { 'kernel iniciou desligamento' }
      42   { 'entrou em suspensão' }
      1    { 'saiu da suspensão / hora ajustada' }
      13   { 'sistema desligado' }
      12   { 'sistema iniciado' }
      1001 { 'TELA AZUL (bugcheck)' }
      default { '' }
    }
    $msg = ($_.Message -replace '\s+', ' ')
    if ($msg.Length -gt 220) { $msg = $msg.Substring(0, 220) + '…' }
    Escreve ("{0:dd/MM/yyyy HH:mm:ss}  [{1}] {2} — {3}" -f $_.TimeCreated, $_.Id, $o, $msg)
  }

# 4. Disco e sistema de arquivos
Titulo '4. ERROS DE DISCO / NTFS'
Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = $desde; Level = 1, 2, 3 } |
  Where-Object { $_.ProviderName -match 'disk|Ntfs|volmgr|storahci|stornvme|iaStor|Microsoft-Windows-Ntfs|partmgr' } |
  Sort-Object TimeCreated |
  ForEach-Object { Escreve ("{0:dd/MM/yyyy HH:mm:ss}  {1} [{2}] {3}" -f $_.TimeCreated, $_.ProviderName, $_.Id, (($_.Message -replace '\s+', ' ') | Select-Object -First 1)) }
Get-PhysicalDisk | ForEach-Object { Escreve ("Disco: {0} · saúde {1} · status {2} · {3:N0} GB" -f $_.FriendlyName, $_.HealthStatus, $_.OperationalStatus, ($_.Size / 1GB)) }
Get-Volume | Where-Object DriveLetter | ForEach-Object { Escreve ("Unidade {0}: livre {1:N1} GB de {2:N1} GB · {3}" -f $_.DriveLetter, ($_.SizeRemaining / 1GB), ($_.Size / 1GB), $_.HealthStatus) }

# 5. Programa caindo / travando
Titulo '5. ERROS DE PROGRAMA (Salgueiro, WebView2, Neutralino)'
Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $desde; Id = 1000, 1002, 1026 } |
  Where-Object { $_.Message -match 'Salgueiro|neutralino|msedgewebview2|WebView' } |
  Sort-Object TimeCreated |
  ForEach-Object { $m = ($_.Message -replace '\s+', ' '); if ($m.Length -gt 300) { $m = $m.Substring(0, 300) + '…' }; Escreve ("{0:dd/MM/yyyy HH:mm:ss}  [{1}] {2}" -f $_.TimeCreated, $_.Id, $m) }

# 6. Atualizações do Windows (reinícios automáticos)
Titulo '6. ATUALIZAÇÕES DO WINDOWS'
Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WindowsUpdateClient'; StartTime = $desde } |
  Sort-Object TimeCreated |
  ForEach-Object { $m = ($_.Message -replace '\s+', ' '); if ($m.Length -gt 200) { $m = $m.Substring(0, 200) + '…' }; Escreve ("{0:dd/MM/yyyy HH:mm:ss}  [{1}] {2}" -f $_.TimeCreated, $_.Id, $m) }

# 7. Antivírus
Titulo '7. ANTIVÍRUS'
$mp = Get-MpComputerStatus
if ($mp) { Escreve ("Defender: proteção em tempo real {0} · última verificação {1}" -f $mp.RealTimeProtectionEnabled, $mp.QuickScanEndTime) }
Get-MpThreatDetection | Where-Object { $_.InitialDetectionTime -ge $desde } |
  ForEach-Object { Escreve ("{0:dd/MM/yyyy HH:mm:ss}  {1}  {2}" -f $_.InitialDetectionTime, $_.ThreatID, ($_.Resources -join ', ')) }
Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object { Escreve ("Antivírus instalado: {0}" -f $_.displayName) }

# 8. Versões Anteriores (cópias de sombra) e energia
Titulo '8. CÓPIAS DE SOMBRA (Versões Anteriores) E ENERGIA'
Get-CimInstance Win32_ShadowCopy | ForEach-Object { Escreve ("Cópia de sombra de {0} em {1}" -f $_.VolumeName, $_.InstallDate) }
if (-not (Get-CimInstance Win32_ShadowCopy)) { Escreve 'Nenhuma cópia de sombra (Versões Anteriores vazias).' }
Escreve ((powercfg /getactivescheme) -join ' ')
Get-CimInstance -ClassName Win32_Battery | ForEach-Object { Escreve ("Bateria: {0}% · status {1}" -f $_.EstimatedChargeRemaining, $_.BatteryStatus) }

# 9. Pastas de cópia feitas por fora
Titulo '9. OUTRAS CÓPIAS DO BANCO NO COMPUTADOR (últimos 20 dias)'
$raizes = @("$env:USERPROFILE\Desktop", "$env:USERPROFILE\Documents", "$env:USERPROFILE\Downloads", "D:\")
foreach ($r in $raizes) {
  if (Test-Path $r) {
    Get-ChildItem -Path $r -Recurse -Depth 2 -File -Include *.db -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch 'node_modules|\\\.git\\|AppData\\Local' } |
      Where-Object { $_.Name -match 'salgueiro|banco|backup' } |
      ForEach-Object { Escreve ("{0}  {1:N0} bytes  {2:dd/MM/yyyy HH:mm}" -f $_.FullName, $_.Length, $_.LastWriteTime) }
  }
}

# Empacota
$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) ("diagnostico-salgueiro-" + $agora.ToString('yyyyMMdd-HHmm') + ".zip")
Compress-Archive -Path (Join-Path $saida '*') -DestinationPath $zip -Force
Write-Host ''
Write-Host '  PRONTO. Arquivo gerado na Área de Trabalho:' -ForegroundColor Green
Write-Host "  $zip"
Write-Host ''
Write-Host '  Mande esse arquivo para análise.'
