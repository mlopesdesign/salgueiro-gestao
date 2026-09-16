# Salgueiro Gestao - Diagnostico e reparo do acesso em rede (multiterminal)
# Rodar pelo DIAGNOSTICO-REDE.bat (ele pede a elevacao de administrador).

$ErrorActionPreference = 'Continue'
$PORTA = 8750
$rel = @()
function L($t) { $script:rel += $t; Write-Host $t }
function Titulo($t) { L ""; L ("=" * 62); L ("  " + $t); L ("=" * 62) }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Titulo "SALGUEIRO GESTAO - DIAGNOSTICO DE REDE"
L ("Data......: " + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'))
L ("Computador: " + $env:COMPUTERNAME)
L ("Usuario...: " + $env:USERNAME)
L ("Admin.....: " + $(if ($admin) { 'SIM' } else { 'NAO - o reparo do firewall nao vai funcionar' }))
L ("Windows...: " + (Get-CimInstance Win32_OperatingSystem).Caption)

$problemas = @()
$avisos    = @()

# ---------------------------------------------------------------- 1. Aplicativo
Titulo "1. O SISTEMA ESTA ABERTO?"
$proc = Get-Process -Name 'Salgueiro Gestao','salgueiro-gestao' -ErrorAction SilentlyContinue
if ($proc) {
  foreach ($p in $proc) { L ("OK  - rodando: " + $p.ProcessName + "  (PID " + $p.Id + ")") }
} else {
  L "FALHA - o Salgueiro Gestao NAO esta aberto neste computador."
  $problemas += "O sistema principal precisa estar ABERTO. Os terminais so funcionam com ele ligado."
}
$ext = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
       Where-Object { $_.CommandLine -like '*servidor-rede.ps1*' }
if ($ext) { L ("OK  - extensao de rede ativa (PID " + $ext.ProcessId + ")") }
else {
  L "FALHA - a extensao de rede (servidor-rede.ps1) nao esta rodando."
  $problemas += "A extensao de rede nao subiu. Feche e abra o Salgueiro Gestao."
}

# ---------------------------------------------------------------- 2. Porta
Titulo "2. A PORTA $PORTA ESTA ESCUTANDO?"
$lis = Get-NetTCPConnection -State Listen -LocalPort $PORTA -ErrorAction SilentlyContinue
if ($lis) {
  foreach ($c in $lis) {
    $dono = (Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    L ("OK  - escutando em " + $c.LocalAddress + ":" + $c.LocalPort + "  (processo: " + $dono + ")")
    if ($c.LocalAddress -eq '127.0.0.1') {
      $problemas += "A porta esta presa em 127.0.0.1 (so este PC). Deveria ser 0.0.0.0."
    }
  }
} else {
  L "FALHA - ninguem esta escutando na porta $PORTA."
  $problemas += "Acesso em rede DESLIGADO no sistema. Abra Configuracoes > Rede, ligue e clique em Aplicar."
}

# ---------------------------------------------------------------- 3. Firewall
Titulo "3. FIREWALL DO WINDOWS"
$regra = Get-NetFirewallRule -DisplayName 'SalgueiroRede' -ErrorAction SilentlyContinue
if (-not $regra) { $regra = Get-NetFirewallRule -Name 'SalgueiroRede' -ErrorAction SilentlyContinue }
if ($regra) {
  foreach ($r in $regra) {
    L ("Regra encontrada: " + $r.DisplayName + " | ativa=" + $r.Enabled + " | " + $r.Direction + "/" + $r.Action + " | perfis=" + $r.Profile)
  }
} else {
  L "FALHA - a regra de firewall 'SalgueiroRede' NAO EXISTE."
  L "        (o instalador tenta criar, mas so consegue se for executado como administrador)"
  $problemas += "Regra de firewall ausente - e por isso que as outras maquinas nao conectam."
}
foreach ($p in (Get-NetFirewallProfile)) {
  L ("Perfil " + $p.Name.PadRight(8) + " firewall=" + $p.Enabled + "  entrada padrao=" + $p.DefaultInboundAction)
}

# ---------------------------------------------------------------- 4. Rede
Titulo "4. REDE DESTE COMPUTADOR"
foreach ($n in (Get-NetConnectionProfile -ErrorAction SilentlyContinue)) {
  L ("Conexao: " + $n.InterfaceAlias + "  | rede: " + $n.Name + "  | tipo: " + $n.NetworkCategory)
  if ($n.NetworkCategory -eq 'Public') {
    $avisos += ("A conexao '" + $n.InterfaceAlias + "' esta marcada como REDE PUBLICA. O Windows bloqueia conexoes de entrada nela.")
  }
}
$ips = @()
foreach ($a in (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notmatch 'Loopback' })) {
  $ips += $a.IPAddress
  L ("IP: " + $a.IPAddress.PadRight(16) + " (" + $a.InterfaceAlias + ")")
}
if ($ips.Count -eq 0) { $problemas += "Este computador nao tem IP de rede. Verifique o cabo / Wi-Fi." }
if ($ips.Count -gt 1) { $avisos += "Ha mais de um IP. O terminal precisa usar o IP da MESMA rede dele." }

# ---------------------------------------------------------------- 5. Teste HTTP
Titulo "5. TESTE DE ACESSO"
function Testa($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec 6 -UseBasicParsing
    L ("OK    " + $url + "  ->  HTTP " + $r.StatusCode + " (" + $r.RawContentLength + " bytes)")
    return $true
  } catch {
    L ("FALHA " + $url + "  ->  " + $_.Exception.Message)
    return $false
  }
}
$local = Testa ("http://127.0.0.1:$PORTA/")
foreach ($ip in $ips) { [void](Testa ("http://" + $ip + ":$PORTA/")) }
if (-not $local -and $lis) {
  $problemas += "A porta esta aberta mas nao responde. Feche e abra o sistema."
}

# ---------------------------------------------------------------- 6. Log
Titulo "6. LOG DA EXTENSAO"
$log = Join-Path $env:LOCALAPPDATA 'SalgueiroGestao\extensions\rede\erro.log'
if (Test-Path $log) {
  L ("Arquivo: " + $log)
  L "--- ultimas 25 linhas ---"
  foreach ($l in (Get-Content $log -Tail 25 -ErrorAction SilentlyContinue)) { L ("  " + $l) }
} else {
  L ("Sem log em " + $log + " (normal se a rede nunca foi ligada)")
}

# ---------------------------------------------------------------- 7. Reparo
Titulo "7. REPARO AUTOMATICO"
if ($admin) {
  try {
    netsh advfirewall firewall delete rule name="SalgueiroRede" | Out-Null
    netsh advfirewall firewall add rule name="SalgueiroRede" dir=in action=allow protocol=TCP localport=$PORTA profile=any | Out-Null
    $ok = Get-NetFirewallRule -DisplayName 'SalgueiroRede' -ErrorAction SilentlyContinue
    if ($ok) { L "OK  - regra de firewall 'SalgueiroRede' criada/recriada para a porta $PORTA (todos os perfis)." }
    else     { L "FALHA - nao consegui criar a regra de firewall." }
  } catch { L ("FALHA - " + $_.Exception.Message) }

  foreach ($n in (Get-NetConnectionProfile -ErrorAction SilentlyContinue)) {
    if ($n.NetworkCategory -eq 'Public') {
      try {
        Set-NetConnectionProfile -InterfaceIndex $n.InterfaceIndex -NetworkCategory Private -ErrorAction Stop
        L ("OK  - a rede '" + $n.Name + "' passou de Publica para Particular.")
      } catch { L ("AVISO - nao consegui mudar a rede '" + $n.Name + "' para Particular: " + $_.Exception.Message) }
    }
  }
} else {
  L "PULADO - este diagnostico nao esta rodando como administrador."
  L "         Clique com o botao direito no DIAGNOSTICO-REDE.bat e escolha 'Executar como administrador'."
}

# ---------------------------------------------------------------- 8. Resumo
Titulo "RESUMO"
if ($problemas.Count -eq 0) {
  L "Nenhum problema encontrado neste computador."
} else {
  L "PROBLEMAS ENCONTRADOS:"
  $i = 1; foreach ($p in $problemas) { L ("  " + $i + ") " + $p); $i++ }
}
if ($avisos.Count -gt 0) {
  L ""; L "AVISOS:"
  $i = 1; foreach ($a in $avisos) { L ("  " + $i + ") " + $a); $i++ }
}
L ""
L "COMO CONECTAR UM TERMINAL:"
if ($ips.Count -gt 0) {
  foreach ($ip in $ips) { L ("  No navegador da outra maquina, abrir:  http://" + $ip + ":" + $PORTA) }
} else {
  L "  (sem IP detectado)"
}
L ""
L "SE AINDA NAO CONECTAR, CONFERIR NA OUTRA MAQUINA:"
L "  - esta na MESMA rede/Wi-Fi (nao pode ser rede de visitantes)"
L "  - ping <IP deste PC> responde"
L "  - antivirus de terceiros (Kaspersky, Avast, McAfee) pode bloquear alem do firewall do Windows"
L "  - roteador com 'isolamento de clientes' / AP isolation ligado impede um PC de ver o outro"

$destino = Join-Path ([Environment]::GetFolderPath('Desktop')) 'RELATORIO-REDE-SALGUEIRO.txt'
try {
  $rel -join "`r`n" | Out-File -FilePath $destino -Encoding UTF8
  Write-Host ""
  Write-Host ("Relatorio salvo em: " + $destino)
  Start-Process notepad.exe $destino
} catch { Write-Host ("Nao consegui salvar o relatorio: " + $_.Exception.Message) }

Write-Host ""
Read-Host "Pressione ENTER para fechar"
