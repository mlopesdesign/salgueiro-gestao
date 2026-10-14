// AUTO-GERADO por tools/gerar-rede-embutida.js — não editar manualmente.
// Fonte: extensions/rede/servidor-rede.ps1. Gerado em: 2026-10-14
export const SERVIDOR_REDE_PS1 = `# Salgueiro Gestão V2 — extensão de acesso em rede (multiterminal) — v3.31.0
# Servidor HTTP em PowerShell puro (nativo do Windows). Encaminha /api para o
# aplicativo principal via WebSocket do Neutralino; serve as telas aos terminais.
param()

$enc = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
trap {
  try { Add-Content -Path (Join-Path $PSScriptRoot 'erro.log') -Value ("[fatal] " + (Get-Date -Format s) + " " + $_.Exception.Message) } catch {}
  try { Log-Rede 'ERRO-FATAL' ([string]$_.Exception.Message) } catch {}
  continue
}

# ─────────────────────────────────────────────────────────────────────────────
# LOG DE DIAGNÓSTICO DA REDE (v3.31.0)
#
# Pedido do Marcio depois de mais um "travou" na loja que trabalha pelo
# navegador: gravar o que acontece para saber SE e ONDE trava.
# Um arquivo por dia em %APPDATA%\\SalgueiroGestao\\logs\\rede-AAAA-MM-DD.log,
# guardado por 30 dias. Cada pedido de um terminal vira uma linha com IP, o que
# foi pedido e quanto tempo levou; o que demorou ou ficou sem resposta é
# marcado. A cada 5 minutos entra uma linha "VIVO" com o resumo.
# A tela Configurações → Rede → Diagnóstico lê estes arquivos.
# ─────────────────────────────────────────────────────────────────────────────
$dirLogs = Join-Path $env:APPDATA 'SalgueiroGestao\\logs'
try { if (-not (Test-Path $dirLogs)) { New-Item -ItemType Directory -Path $dirLogs -Force | Out-Null } } catch {}
function Log-Rede([string]$tipo, [string]$msg) {
  try {
    $agora = Get-Date
    $arq = Join-Path $dirLogs ('rede-' + $agora.ToString('yyyy-MM-dd') + '.log')
    [System.IO.File]::AppendAllText($arq, ($agora.ToString('HH:mm:ss.fff') + ' ' + $tipo.PadRight(13) + ' ' + $msg + "\`r\`n"), $enc)
  } catch {}
}
try {
  Get-ChildItem $dirLogs -Filter '*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force -ErrorAction SilentlyContinue
} catch {}

# configuracao: Neutralino manda um JSON pela stdin ao iniciar a extensao;
# em testes aceitamos tambem argumentos --nl-*.
$nlPort = ''; $nlToken = ''; $nlConnect = ''; $nlExtId = 'br.com.mllopes.salgueiro.rede'
$leituraStdin = [Console]::In.ReadLineAsync()
if ($leituraStdin.Wait(3000) -and $leituraStdin.Result) {
  try {
    $cfg = $leituraStdin.Result | ConvertFrom-Json
    if ($cfg.nlPort) { $nlPort = [string]$cfg.nlPort }
    if ($cfg.nlToken) { $nlToken = [string]$cfg.nlToken }
    if ($cfg.nlConnectToken) { $nlConnect = [string]$cfg.nlConnectToken }
    if ($cfg.nlExtensionId) { $nlExtId = [string]$cfg.nlExtensionId }
  } catch {}
}
foreach ($a in $args) {
  if ($a -like '--nl-port=*') { $nlPort = $a.Substring(10) }
  elseif ($a -like '--nl-token=*') { $nlToken = $a.Substring(11) }
  elseif ($a -like '--nl-connect-token=*') { $nlConnect = $a.Substring(19) }
  elseif ($a -like '--nl-extension-id=*') { $nlExtId = $a.Substring(19) }
}
if (-not $nlConnect -and $nlToken -and $nlToken.Contains('.')) { $nlConnect = $nlToken.Split('.')[1] }
if (-not $nlConnect) { $nlConnect = $nlToken }
if (-not $nlPort) { exit 1 }

# conexao WebSocket com o aplicativo
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [Uri]("ws://127.0.0.1:$nlPort" + "?extensionId=$nlExtId" + "&connectToken=$nlConnect")
$ws.ConnectAsync($uri, [Threading.CancellationToken]::None).Wait()

function Enviar-Evento([string]$evento, $dados) {
  $msg = @{ id = [Guid]::NewGuid().ToString('N'); method = 'app.broadcast';
            accessToken = $nlToken; data = @{ event = $evento; data = $dados } } |
         ConvertTo-Json -Depth 14 -Compress
  $b = $enc.GetBytes($msg)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$b)
  try {
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true,
      [Threading.CancellationToken]::None).Wait() | Out-Null
  } catch {}
}

$wsBuf = New-Object byte[] 262144
$wsTexto = New-Object System.Text.StringBuilder
$script:tarefaWS = $null

# Lê UMA mensagem do aplicativo, se houver. Devolve $true quando processou algo.
# O corpo das respostas vem PRONTO em texto JSON (campo \`json\`): aqui ele não é
# desmontado nem remontado — no PowerShell isso custava segundos em relatório
# grande e segurava todos os terminais. (v3.31.0)
function Bombear-WS([int]$timeoutMs) {
  if ($ws.State -ne 'Open') { return $false }
  if (-not $script:tarefaWS) {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$wsBuf)
    $script:tarefaWS = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
  }
  if (-not $script:tarefaWS.Wait($timeoutMs)) { return $false }
  $r = $script:tarefaWS.Result
  $script:tarefaWS = $null
  [void]$wsTexto.Append($enc.GetString($wsBuf, 0, $r.Count))
  if (-not $r.EndOfMessage) { return $true }
  $msg = $wsTexto.ToString(); [void]$wsTexto.Clear()
  $m = $null
  try { $m = $msg | ConvertFrom-Json } catch { Log-Rede 'ERRO-WS' ("mensagem ilegivel (" + $msg.Length + " caracteres)"); return $true }
  if (-not $m -or -not $m.event) { return $true }
  if ($m.event -eq 'rede.resposta' -and $m.data -and $m.data.reqId) {
    $json = $null
    if ($null -ne $m.data.json) { $json = [string]$m.data.json }
    else { $json = ($m.data.corpo | ConvertTo-Json -Depth 14 -Compress) }   # aplicativo antigo
    Entregar-Resposta ([string]$m.data.reqId) $json
  }
  elseif ($m.event -eq 'rede.iniciar')    { Iniciar-Http ([int]$m.data.porta) }
  elseif ($m.event -eq 'rede.parar')      { Parar-Http }
  elseif ($m.event -eq 'rede.ping')       { Enviar-Evento 'rede.pong' @{ ok = $true } }
  elseif ($m.event -eq 'rede.impressoras'){ Enviar-Evento 'rede.impressoras.resp' @{ impressoras = @(Listar-Impressoras) } }
  elseif ($m.event -eq 'rede.imprimir')   { Imprimir-Silencioso $m.data }
  elseif ($m.event -eq 'nuvem.oauthIniciar') { Iniciar-OAuthListener ([int]$m.data.porta) }
  return $true
}

function Listar-IPs {
  $out = @()
  try {
    $nics = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notmatch 'Loopback' }
    foreach ($n in $nics) { $out += @{ interface = [string]$n.InterfaceAlias; ip = [string]$n.IPAddress } }
  } catch {
    try {
      $h = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName())
      foreach ($ip in $h.AddressList) {
        if ($ip.AddressFamily -eq 'InterNetwork' -and -not [System.Net.IPAddress]::IsLoopback($ip)) {
          $out += @{ interface = 'rede'; ip = $ip.ToString() }
        }
      }
    } catch {}
  }
  return $out
}

function Listar-Impressoras {
  $out = @()
  try {
    $imps = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop
    foreach ($i in $imps) { $out += @{ nome = [string]$i.Name; padrao = [bool]$i.Default } }
  } catch {}
  return $out
}

# ─────────────────────────────────────────────────────────────────────────────
# IMPRESSÃO SILENCIOSA EM SEGUNDO PLANO (v3.31.0)
#
# Antes a impressão rodava DENTRO do laço do servidor: Edge gerando o PDF (até
# 12 s) + SumatraPDF imprimindo (até 12 s) — e, sem o SumatraPDF, um download
# sem prazo. Durante esse tempo NENHUM terminal era atendido: cada cupom ou
# etiqueta impresso no computador principal congelava a loja que usa o
# navegador. Agora ela roda num "runspace" separado; o laço só confere se
# terminou (Verificar-Impressoes) e continua atendendo os terminais.
# ─────────────────────────────────────────────────────────────────────────────
$codigoImpressao = {
param($dados, $raiz)
$enc = [System.Text.Encoding]::UTF8
# gancho de teste automatizado: simula impressora lenta
if ($dados.teste_espera_ms) { Start-Sleep -Milliseconds ([int]$dados.teste_espera_ms); return @{ ok = $true; erro = '' } }
# Retorna o caminho do Edge instalado (sempre presente no Win10/11)
function Get-EdgePath {
  $paths = @(
    "$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"
  )
  foreach ($p in $paths) { if (Test-Path $p) { return $p } }
  # Fallback: busca no registro
  try {
    $reg = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe' -EA Stop).'(Default)'
    if ($reg -and (Test-Path $reg)) { return $reg }
  } catch {}
  return $null
}

# Localiza SumatraPDF portable: 1) bundled junto ao app, 2) baixado antes, 3) baixar agora
function Garantir-SumatraPDF {
  # 1. Bundled: instalado junto com o app na mesma pasta da extensão (sem precisar de internet)
  $bundled = Join-Path $raiz 'SumatraPDF.exe'
  if (Test-Path $bundled) { return $bundled }
  # 2. Já baixado em sessão anterior
  $dest = "$env:APPDATA\\SalgueiroGestao\\tools\\SumatraPDF.exe"
  if (Test-Path $dest) { return $dest }
  # 3. Tentar baixar (fallback para máquinas com acesso à internet)
  try {
    $dir = Split-Path $dest
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $wc = New-Object System.Net.WebClient
    $wc.Proxy = [System.Net.WebRequest]::GetSystemWebProxy()
    $wc.Proxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
    # Tentativas em ordem: ZIP 3.6.1 (portable), exe 3.6.1, zip 3.5.2
    $tentativas = @(
      @{ url = 'https://github.com/sumatrapdfreader/sumatrapdf/releases/download/3.6.1rel/SumatraPDF-3.6.1-64.zip'; zip = $true },
      @{ url = 'https://github.com/sumatrapdfreader/sumatrapdf/releases/download/3.6.1rel/SumatraPDF-3.6.1-64.exe'; zip = $false },
      @{ url = 'https://github.com/sumatrapdfreader/sumatrapdf/releases/download/3.5.2/SumatraPDF-3.5.2-64.exe'; zip = $false }
    )
    foreach ($t in $tentativas) {
      try {
        if ($t.zip) {
          $zip = "$dest.zip"
          $wc.DownloadFile($t.url, $zip)
          if ((Get-Item $zip).Length -gt 100000) {
            Add-Type -Assembly System.IO.Compression.FileSystem
            $z = [IO.Compression.ZipFile]::OpenRead($zip)
            foreach ($e in $z.Entries) {
              if ($e.Name -like 'SumatraPDF*.exe' -and $e.Name -notlike '*install*') {
                [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
                break
              }
            }
            $z.Dispose()
          }
          try { Remove-Item $zip -EA 0 } catch {}
        } else {
          $wc.DownloadFile($t.url, $dest)
        }
        if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 100000) { return $dest }
      } catch {}
    }
  } catch {}
  return $null
}

  $ok = $false; $erro = ''; $tmp = $null; $pdf = $null
  $logPath = "$env:APPDATA\\SalgueiroGestao\\impressao.log"
  function Log([string]$msg) {
    try { Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] $msg" -Encoding UTF8 } catch {}
  }
  try {
    $html       = [string]$dados.conteudo
    $impressora = [string]$dados.impressora
    $tipo       = if ($dados.tipo) { [string]$dados.tipo } else { 'cupom' }
    $tmp = [System.IO.Path]::GetTempFileName() + '.html'
    [System.IO.File]::WriteAllText($tmp, $html, $enc)

    # --- Caminho silencioso: Edge headless → PDF (tamanho correto) → SumatraPDF ---
    $edge    = Get-EdgePath
    $sumatra = Garantir-SumatraPDF
    Log "tipo=$tipo edge=$edge sumatra=$sumatra impressora=$impressora"
    if ($edge -and $sumatra) {
      $pdf = [System.IO.Path]::GetTempFileName() + '.pdf'
      $fileUrl = 'file:///' + $tmp.Replace('\\', '/')

      # Dimensões em polegadas (1 mm = 0.03937 in).
      # Etiqueta: 60×40mm fixo. Cupom: 80mm de largura; altura via CSS @page{size:80mm auto}.
      if ($tipo -eq 'etiqueta') {
        $dimArgs = @('--paper-width=2.362', '--paper-height=1.575')
      } else {
        $dimArgs = @('--paper-width=3.150')
      }

      # ATENÇÃO: $edgeArgs (não $args — variável automática do PS)
      $edgeArgs = @('--headless=new', '--disable-gpu', '--no-sandbox',
                    '--run-all-compositor-stages-before-draw',
                    '--print-to-pdf-no-margins') +
                  $dimArgs +
                  @("--print-to-pdf=$pdf", '--print-to-pdf-no-header', $fileUrl)

      $p = Start-Process -FilePath $edge -ArgumentList $edgeArgs -WindowStyle Hidden -PassThru
      $p.WaitForExit(12000) | Out-Null
      $pdfTam = (Get-Item $pdf -ErrorAction SilentlyContinue).Length
      $pdfOk  = ($pdfTam -gt 200)
      Log "edge exit=$($p.ExitCode) pdf_tam=$pdfTam"

      if ($pdfOk) {
        # Imprimir PDF sem diálogo via SumatraPDF; noscale = respeita tamanho do PDF
        $sargs = @('-print-to', $impressora, '-print-settings', 'noscale',
                   '-silent', '-exit-when-done', $pdf)
        $sp = Start-Process -FilePath $sumatra -ArgumentList $sargs -WindowStyle Hidden -PassThru
        $sp.WaitForExit(12000) | Out-Null
        Log "sumatra exit=$($sp.ExitCode)"
        $ok = ($sp.ExitCode -eq 0)
      }
    }
    # Se $ok=$false o JS exibe fallback imediato (popup/window.print) sem esperar aqui
  } catch {
    $erro = [string]$_.Exception.Message
    Log "erro: $erro"
  } finally {
    if ($tmp) { try { Remove-Item $tmp -ErrorAction SilentlyContinue } catch {} }
    if ($pdf) { try { Remove-Item $pdf -ErrorAction SilentlyContinue } catch {} }
  }
  return @{ ok = $ok; erro = $erro }
}

$script:impressoes = New-Object System.Collections.ArrayList
function Imprimir-Silencioso($dados) {
  try {
    $ps = [PowerShell]::Create()
    [void]$ps.AddScript($codigoImpressao.ToString()).AddArgument($dados).AddArgument($PSScriptRoot)
    $h = $ps.BeginInvoke()
    [void]$script:impressoes.Add(@{ ps = $ps; h = $h; inicio = [DateTime]::UtcNow; tipo = [string]$dados.tipo })
  } catch {
    Log-Rede 'IMPRESSAO' ("nao iniciou: " + $_.Exception.Message)
    Enviar-Evento 'rede.imprimir.resp' @{ ok = $false; erro = [string]$_.Exception.Message }
  }
}
function Verificar-Impressoes {
  for ($i = $script:impressoes.Count - 1; $i -ge 0; $i--) {
    $t = $script:impressoes[$i]
    $ms = [int]([DateTime]::UtcNow - $t.inicio).TotalMilliseconds
    if ($t.h.IsCompleted) {
      $ok = $false; $erro = ''
      try {
        $res = $t.ps.EndInvoke($t.h)
        $ult = $null; foreach ($x in $res) { $ult = $x }
        if ($ult) { $ok = [bool]$ult.ok; $erro = [string]$ult.erro }
      } catch { $erro = [string]$_.Exception.Message }
      try { $t.ps.Dispose() } catch {}
      $script:impressoes.RemoveAt($i)
      Log-Rede 'IMPRESSAO' ("$($t.tipo) ok=$ok \${ms}ms $erro")
      Enviar-Evento 'rede.imprimir.resp' @{ ok = $ok; erro = $erro }
    } elseif ($ms -gt 60000) {
      try { $t.ps.Stop() } catch {}
      try { $t.ps.Dispose() } catch {}
      $script:impressoes.RemoveAt($i)
      Log-Rede 'IMPRESSAO' ("$($t.tipo) CANCELADA: passou de 60 s")
      Enviar-Evento 'rede.imprimir.resp' @{ ok = $false; erro = 'A impressao passou de 60 segundos e foi cancelada.' }
    }
  }
}

# OAuth 2.0 PKCE: listener temporario na porta 9741 para receber o callback do browser
$script:oauthListener = $null

function Iniciar-OAuthListener([int]$porta) {
  if ($script:oauthListener) { try { $script:oauthListener.Stop() } catch {}; $script:oauthListener = $null }
  try {
    $script:oauthListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $porta)
    $script:oauthListener.Start()
  } catch {
    $script:oauthListener = $null
    Enviar-Evento 'nuvem.oauth.callback' @{ erro = "Porta OAuth $porta indisponivel: $($_.Exception.Message)" }
  }
}

function Tratar-OAuthCallback($cliente) {
  $stream = $cliente.GetStream()
  $stream.ReadTimeout = 5000; $stream.WriteTimeout = 5000
  $code = ''; $state = ''; $erro = ''
  try {
    $req = Ler-Requisicao $stream
    if ($req -and $req.caminho) {
      $partes = $req.caminho -split '\\?', 2
      if ($partes.Count -eq 2) {
        foreach ($par in $partes[1] -split '&') {
          $kv = $par -split '=', 2
          if ($kv.Count -eq 2) {
            $k = [Uri]::UnescapeDataString($kv[0].Replace('+', ' '))
            $v = [Uri]::UnescapeDataString($kv[1].Replace('+', ' '))
            if     ($k -eq 'code')  { $code  = $v }
            elseif ($k -eq 'state') { $state = $v }
            elseif ($k -eq 'error') { $erro  = $v }
          }
        }
      }
    }
    $msgHtml = if ($erro) { "<h2>Falha na autenticacao</h2><p>$erro</p>" }
               else       { '<h2>Autenticado com sucesso!</h2><p>Pode fechar esta aba e voltar ao Salgueiro Gestao.</p>' }
    $bodyHtml = $enc.GetBytes("<html><body style='font-family:sans-serif;text-align:center;padding-top:60px'>$msgHtml<script>setTimeout(function(){window.close()},3000)</script></body></html>")
    Responder $stream 200 'text/html; charset=utf-8' $bodyHtml
    if ($erro) { Enviar-Evento 'nuvem.oauth.callback' @{ erro = $erro } }
    else        { Enviar-Evento 'nuvem.oauth.callback' @{ code = $code; state = $state } }
  } catch {
    Enviar-Evento 'nuvem.oauth.callback' @{ erro = "Erro no callback OAuth: $($_.Exception.Message)" }
  } finally {
    try { $stream.Close() } catch {}
    try { $cliente.Close() } catch {}
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# SERVIDOR HTTP DOS TERMINAIS (TcpListener puro: não exige administrador)
#
# v3.31.0 — ATENDE VÁRIOS TERMINAIS AO MESMO TEMPO.
# Antes era uma fila de um só: o servidor pegava uma conexão, esperava o pedido
# chegar (até 5 s), mandava para o sistema e ficava parado esperando a resposta
# (até 20 s) — e só então olhava o próximo. Bastava o navegador abrir uma
# conexão "de reserva" sem mandar nada (o Edge e o Chrome fazem isso o tempo
# todo) ou o sistema demorar num relatório para TODOS os terminais congelarem.
#
# Agora:
#   • conexão nova entra numa lista e só é lida quando chega dado (nada espera);
#   • o pedido vai para o sistema e a conexão fica guardada pelo número dele;
#     a resposta é entregue quando chega, sem segurar ninguém;
#   • sem resposta em 30 s, o terminal recebe aviso claro e o log registra;
#   • conexão parada há 20 s sem completar o pedido é descartada.
# ─────────────────────────────────────────────────────────────────────────────
$script:http = $null
$script:conexoes = New-Object System.Collections.ArrayList
$script:pendentes = @{}
$script:bufLeitura = New-Object byte[] 65536
$script:estat = @{ req = 0; lentas = 0; semResp = 0; maior = 0; desde = [DateTime]::UtcNow }
$LIMITE_RESPOSTA_S = 30
$LIMITE_LEITURA_S  = 20
$LIMITE_CORPO      = 16777216   # 16 MB (foto em base64 cabe com folga)

function Iniciar-Http([int]$porta) {
  Parar-Http
  try {
    $script:http = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $porta)
    $script:http.Start()
    Log-Rede 'SERVIDOR' "ligado na porta $porta"
    Enviar-Evento 'rede.status' @{ ativa = $true; porta = $porta; ips = @(Listar-IPs) }
  } catch {
    $script:http = $null
    Log-Rede 'SERVIDOR' ("NAO ligou na porta $porta : " + $_.Exception.Message)
    Enviar-Evento 'rede.status' @{ ativa = $false; erro = "Nao foi possivel abrir a porta $porta (ja esta em uso?)." }
  }
}
function Parar-Http {
  if ($script:http) {
    try { $script:http.Stop() } catch {}
    $script:http = $null
    foreach ($c in @($script:conexoes)) { Fechar-Conexao $c }
    $script:conexoes.Clear()
    foreach ($p in @($script:pendentes.Values)) { Fechar-Conexao $p }
    $script:pendentes.Clear()
    Log-Rede 'SERVIDOR' 'desligado'
    Enviar-Evento 'rede.status' @{ ativa = $false }
  }
}

# Leitura bloqueante — usada só no retorno do login do Google Drive (localhost).
function Ler-Requisicao($stream) {
  $ms = New-Object System.IO.MemoryStream
  $b = New-Object byte[] 8192
  $cabecalho = ''
  while ($true) {
    $n = 0
    try { $n = $stream.Read($b, 0, $b.Length) } catch { break }
    if ($n -le 0) { break }
    $ms.Write($b, 0, $n)
    $cabecalho = $enc.GetString($ms.ToArray())
    if ($cabecalho.Contains("\`r\`n\`r\`n")) { break }
    if ($ms.Length -gt 1048576) { break }
  }
  $tudo = $ms.ToArray()
  $sep = $cabecalho.IndexOf("\`r\`n\`r\`n")
  if ($sep -lt 0) { return $null }
  $head = $cabecalho.Substring(0, $sep)
  $linhas = $head -split "\`r\`n"
  $req = @{ metodo = ($linhas[0] -split ' ')[0]; caminho = ($linhas[0] -split ' ')[1]; headers = @{} }
  foreach ($l in $linhas[1..($linhas.Count - 1)]) {
    $i = $l.IndexOf(':')
    if ($i -gt 0) { $req.headers[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() }
  }
  $req.corpo = ''
  return $req
}

function Responder($stream, [int]$codigo, [string]$tipo, [byte[]]$corpo) {
  $st = 'OK'
  if ($codigo -eq 404) { $st = 'Not Found' } elseif ($codigo -eq 504) { $st = 'Gateway Timeout' } elseif ($codigo -ge 500) { $st = 'Error' } elseif ($codigo -eq 413) { $st = 'Payload Too Large' }
  $h = "HTTP/1.1 $codigo $st\`r\`nContent-Type: $tipo\`r\`nContent-Length: $($corpo.Length)\`r\`nConnection: close\`r\`nCache-Control: no-store\`r\`n\`r\`n"
  $hb = $enc.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if ($corpo.Length -gt 0) { $stream.Write($corpo, 0, $corpo.Length) }
  $stream.Flush()
}

function Fechar-Conexao($c) {
  try { $c.stream.Close() } catch {}
  try { $c.cli.Close() } catch {}
}

function Nova-Conexao($cli) {
  $ip = '?'
  try { $ip = [string]$cli.Client.RemoteEndPoint.Address } catch {}
  $c = @{ cli = $cli; stream = $cli.GetStream(); buf = (New-Object System.IO.MemoryStream);
          inicio = [DateTime]::UtcNow; ip = $ip }
  $c.stream.WriteTimeout = 15000
  [void]$script:conexoes.Add($c)
}

# Monta o pedido com o que já chegou. $null = ainda incompleto.
function Montar-Requisicao($c) {
  $n = [int]$c.buf.Length
  if ($n -lt 16) { return $null }
  $tudo = $c.buf.ToArray()
  $cab = [System.Text.Encoding]::ASCII.GetString($tudo, 0, [Math]::Min($n, 65536))
  $sep = $cab.IndexOf("\`r\`n\`r\`n")
  if ($sep -lt 0) { return $null }
  $linhas = $cab.Substring(0, $sep) -split "\`r\`n"
  $partes = $linhas[0] -split ' '
  $req = @{ metodo = $partes[0]; caminho = $partes[1]; headers = @{} }
  for ($k = 1; $k -lt $linhas.Count; $k++) {
    $l = $linhas[$k]; $i = $l.IndexOf(':')
    if ($i -gt 0) { $req.headers[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() }
  }
  $clen = 0
  if ($req.headers['content-length']) { $clen = [int]$req.headers['content-length'] }
  $ini = $sep + 4
  if (($n - $ini) -lt $clen) { return $null }
  $req.corpo = $enc.GetString($tudo, $ini, $clen)
  return $req
}

function Registrar-Pedido([string]$ip, [string]$canal, [int]$ms, [string]$situacao) {
  $script:estat.req++
  if ($ms -gt $script:estat.maior) { $script:estat.maior = $ms }
  if ($situacao -eq 'OK') {
    if ($ms -ge 3000) { $script:estat.lentas++; Log-Rede 'LENTO' "$ip $canal \${ms}ms" }
    else { Log-Rede 'OK' "$ip $canal \${ms}ms" }
  } else {
    $script:estat.semResp++
    Log-Rede $situacao "$ip $canal \${ms}ms"
  }
}

function Entregar-Resposta([string]$reqId, [string]$json) {
  $p = $script:pendentes[$reqId]
  if (-not $p) { Log-Rede 'ATRASADA' "resposta $reqId chegou depois do prazo"; return }
  $script:pendentes.Remove($reqId)
  $ms = [int]([DateTime]::UtcNow - $p.inicio).TotalMilliseconds
  $situacao = 'OK'
  try { Responder $p.stream 200 'application/json; charset=utf-8' $enc.GetBytes($json) }
  catch { $situacao = 'TERMINAL-SAIU' }
  Fechar-Conexao $p
  Registrar-Pedido $p.ip $p.canal $ms $situacao
}

function Atender($c, $req) {
  if ($req.metodo -eq 'POST' -and $req.caminho -eq '/api') {
    $reqId = [Guid]::NewGuid().ToString('N')
    $token = ''
    if ($req.headers['x-token']) { $token = $req.headers['x-token'] }
    # O canal é lido só para o log; o corpo vai INTEIRO e em texto para o
    # sistema, que é quem o interpreta (v3.31.0).
    $canal = '?'
    $mc = [regex]::Match($req.corpo, '"canal"\\s*:\\s*"([^"]{1,80})"')
    if ($mc.Success) { $canal = $mc.Groups[1].Value }
    $c.canal = $canal
    $c.inicio = [DateTime]::UtcNow
    $script:pendentes[$reqId] = $c
    Enviar-Evento 'rede.api' @{ v = 2; reqId = $reqId; corpo = $req.corpo; token = $token; ip = $c.ip }
    return
  }
  try {
    $caminho = $req.caminho
    if (-not $caminho) { $caminho = '/' }
    $q = $caminho.IndexOf('?'); if ($q -ge 0) { $caminho = $caminho.Substring(0, $q) }
    if ($caminho -eq '/') { $caminho = '/index.html' }
    if ($caminho.Contains('..')) { Responder $c.stream 404 'text/plain' $enc.GetBytes('nao'); return }
    try {
      # Bytes brutos para preservar UTF-8 (Invoke-WebRequest decodificaria com
      # o encoding do Windows, que pode não ser UTF-8)
      $wc = New-Object System.Net.WebClient
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $conteudo = $wc.DownloadData("http://127.0.0.1:$nlPort" + $caminho)
      $tipo = $wc.ResponseHeaders['Content-Type']
      if (-not $tipo) { $tipo = 'application/octet-stream' }
      if ($tipo -match '^text/' -and $tipo -notmatch 'charset') { $tipo = $tipo + '; charset=utf-8' }
      if ($caminho -eq '/index.html') {
        $html = $enc.GetString($conteudo)
        $html = $html.Replace('<head>', '<head><script>window.__TERMINAL_REDE=1;</script>')
        $conteudo = $enc.GetBytes($html)
        $tipo = 'text/html; charset=utf-8'
        Log-Rede 'TELA' "$($c.ip) abriu o sistema no navegador"
      }
      Responder $c.stream 200 $tipo $conteudo
    } catch {
      Log-Rede 'ARQUIVO-404' "$($c.ip) $caminho"
      Responder $c.stream 404 'text/plain; charset=utf-8' $enc.GetBytes('Arquivo nao encontrado.')
    }
  } catch {
  } finally {
    Fechar-Conexao $c
  }
}

# Lê o que chegou em cada conexão aberta e atende as que completaram o pedido.
function Servir-Conexoes {
  for ($i = $script:conexoes.Count - 1; $i -ge 0; $i--) {
    $c = $script:conexoes[$i]
    try {
      $leu = $false
      while ($c.stream.DataAvailable -and $c.buf.Length -le $LIMITE_CORPO) {
        $n = $c.stream.Read($script:bufLeitura, 0, $script:bufLeitura.Length)
        if ($n -le 0) { break }
        $c.buf.Write($script:bufLeitura, 0, $n); $leu = $true
      }
      if ($leu) {
        $req = Montar-Requisicao $c
        if ($req) { $script:conexoes.RemoveAt($i); Atender $c $req; continue }
      }
      if ($c.buf.Length -gt $LIMITE_CORPO) {
        $script:conexoes.RemoveAt($i)
        Log-Rede 'GRANDE-DEMAIS' "$($c.ip) pedido com mais de 16 MB"
        try { Responder $c.stream 413 'application/json; charset=utf-8' $enc.GetBytes('{"ok":false,"erro":"Pedido grande demais."}') } catch {}
        Fechar-Conexao $c; continue
      }
      # o navegador fechou a conexão de reserva sem mandar nada
      $fechou = $false
      try { $fechou = ($c.cli.Client.Poll(0, [System.Net.Sockets.SelectMode]::SelectRead) -and $c.cli.Client.Available -eq 0) } catch { $fechou = $true }
      $idade = ([DateTime]::UtcNow - $c.inicio).TotalSeconds
      if ($fechou -or $idade -gt $LIMITE_LEITURA_S) {
        $script:conexoes.RemoveAt($i)
        if ($c.buf.Length -gt 0) { Log-Rede 'INCOMPLETO' ("$($c.ip) pedido pela metade (" + $c.buf.Length + " bytes em " + [int]$idade + " s)") }
        Fechar-Conexao $c
      }
    } catch {
      try { $script:conexoes.RemoveAt($i) } catch {}
      Log-Rede 'ERRO-CONEXAO' ("$($c.ip) " + $_.Exception.Message)
      Fechar-Conexao $c
    }
  }
}

# Pedidos que o sistema não respondeu no prazo: o terminal recebe aviso claro.
function Vencer-Pendentes {
  if ($script:pendentes.Count -eq 0) { return }
  $agora = [DateTime]::UtcNow
  foreach ($id in @($script:pendentes.Keys)) {
    $p = $script:pendentes[$id]
    $ms = [int]($agora - $p.inicio).TotalMilliseconds
    if ($ms -gt ($LIMITE_RESPOSTA_S * 1000)) {
      $script:pendentes.Remove($id)
      try {
        Responder $p.stream 504 'application/json; charset=utf-8' $enc.GetBytes('{"ok":false,"erro":"O computador principal nao respondeu em 30 segundos. Tente de novo.","sem_resposta":true}')
      } catch {}
      Fechar-Conexao $p
      Registrar-Pedido $p.ip $p.canal $ms 'SEM-RESPOSTA'
    }
  }
}

$script:ultimoVivo = [DateTime]::UtcNow
function Batimento {
  $agora = [DateTime]::UtcNow
  if (($agora - $script:ultimoVivo).TotalSeconds -lt 300) { return }
  $script:ultimoVivo = $agora
  $e = $script:estat
  $lig = 'nao'; if ($script:http) { $lig = 'sim' }
  Log-Rede 'VIVO' ("servidor=$lig pedidos=" + $e.req + " lentos=" + $e.lentas + " sem_resposta=" + $e.semResp +
    " maior=" + $e.maior + "ms abertas=" + $script:conexoes.Count + " esperando=" + $script:pendentes.Count +
    " impressoes=" + $script:impressoes.Count + " ws=" + $ws.State)
  $script:estat = @{ req = 0; lentas = 0; semResp = 0; maior = 0; desde = $agora }
}

# PID do aplicativo principal (processo pai desta extensão)
$ppid = 0
try {
  $ppid = [int](Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction Stop).ParentProcessId
} catch {}

# Força janela à frente ao inicializar (PDV deve ter prioridade de foco)
try {
  if ($ppid -gt 0) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.Interaction]::AppActivate($ppid)
  }
} catch {}

# ─────────────────────────────────────────────────────────────────────────────
# AJUSTE DA JANELA DO PDV
#
# 1) Remove o botão do meio (maximizar/restaurar): tira SOMENTE WS_MAXIMIZEBOX.
#    Não encosta em WS_THICKFRAME — foi remover esse outro bit (via
#    "resizable": false) que quebrou a v3.25.13.
#
# 2) Amarra o tamanho de restauração à área de trabalho do monitor. O Neutralino
#    abre com maximize:true sem nunca definir um tamanho "normal" válido; o
#    Windows fica com rcNormalPosition zerado e restaurar joga a janela para um
#    tamanho degenerado — é isso que a faz sumir e piscar o fundo.
#    (Bug do Neutralino, issue #1281, aberto na 6.3.0.)
#    A área de trabalho é lida do sistema, então serve para qualquer resolução.
#
# A janela é achada varrendo a lista de janelas de topo por Z-order e filtrando
# pelo PID — NÃO por MainWindowHandle, que na v3.25.18 voltou vazio.
#
# Win32 declarado via Reflection.Emit, não Add-Type: Add-Type compila C# pelo
# csc.exe, que abre janelas pretas de terminal.
# ─────────────────────────────────────────────────────────────────────────────
$logJanela = "$env:APPDATA\\SalgueiroGestao\\janela.log"
function LogJanela([string]$m) {
  try { Add-Content -Path $logJanela -Value "[$(Get-Date -Format s)] $m" -Encoding UTF8 } catch {}
}

try {
  $nomeAsm = New-Object System.Reflection.AssemblyName('SalgWin32')
  $acesso  = [System.Reflection.Emit.AssemblyBuilderAccess]::Run
  $asm = $null
  try { $asm = [AppDomain]::CurrentDomain.DefineDynamicAssembly($nomeAsm, $acesso) } catch {}
  if (-not $asm) { $asm = [System.Reflection.Emit.AssemblyBuilder]::DefineDynamicAssembly($nomeAsm, $acesso) }
  $tipo = $asm.DefineDynamicModule('SalgWin32Mod').DefineType('SalgU32', 'Public, Class')

  $attr = [System.Reflection.MethodAttributes]'Public, Static, PinvokeImpl'
  $conv = [System.Reflection.CallingConventions]::Standard
  $nat  = [System.Runtime.InteropServices.CallingConvention]::Winapi
  $chs  = [System.Runtime.InteropServices.CharSet]::Auto
  $psig = [System.Reflection.MethodImplAttributes]::PreserveSig
  $intRef = [int].MakeByRefType()

  $api = @(
    @('GetDesktopWindow',        [IntPtr], @()),
    @('GetTopWindow',            [IntPtr], @([IntPtr])),
    @('GetWindow',               [IntPtr], @([IntPtr],[uint32])),
    @('IsWindowVisible',         [bool],   @([IntPtr])),
    @('GetWindowTextLengthW',    [int],    @([IntPtr])),
    @('GetWindowThreadProcessId',[uint32], @([IntPtr],$intRef)),
    @('GetWindowLongW',          [int],    @([IntPtr],[int])),
    @('SetWindowLongW',          [int],    @([IntPtr],[int],[int])),
    @('SetWindowPos',            [bool],   @([IntPtr],[IntPtr],[int],[int],[int],[int],[uint32])),
    @('GetWindowPlacement',      [bool],   @([IntPtr],[IntPtr])),
    @('SetWindowPlacement',      [bool],   @([IntPtr],[IntPtr])),
    @('SystemParametersInfoW',   [bool],   @([uint32],[uint32],[IntPtr],[uint32]))
  )
  foreach ($f in $api) {
    $tipo.DefinePInvokeMethod($f[0],'user32.dll',$attr,$conv,$f[1],$f[2],$nat,$chs).SetImplementationFlags($psig)
  }
  $U32 = $tipo.CreateType()

  $GWL_STYLE      = -16
  $WS_MAXIMIZEBOX = 0x00010000
  $GW_HWNDNEXT    = [uint32]2
  $SWP_REDESENHAR = [uint32]0x0037   # NOSIZE|NOMOVE|NOZORDER|NOACTIVATE|FRAMECHANGED
  $SPI_GETWORKAREA= [uint32]0x0030
  $SW_SHOWMAXIMIZED = 3

  # PIDs que contam como "o aplicativo": o processo pai e qualquer processo
  # cujo nome pareça o do PDV (cobre o caso do pai não ser a janela).
  $pidsAlvo = New-Object 'System.Collections.Generic.HashSet[int]'
  if ($ppid -gt 0) { [void]$pidsAlvo.Add([int]$ppid) }
  try {
    Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.ProcessName -like '*algueiro*' } |
      ForEach-Object { [void]$pidsAlvo.Add([int]$_.Id) }
  } catch {}
  LogJanela ("ppid=$ppid pids alvo=" + ($pidsAlvo -join ','))

  # Varre janelas de topo por Z-order procurando uma visível, com título, do PDV
  function AcharJanela {
    $achada = [IntPtr]::Zero
    try {
      $h = $U32::GetTopWindow($U32::GetDesktopWindow())
      while ($h -ne [IntPtr]::Zero) {
        if ($U32::IsWindowVisible($h) -and $U32::GetWindowTextLengthW($h) -gt 0) {
          $wpid = 0
          [void]$U32::GetWindowThreadProcessId($h, [ref]$wpid)
          if ($pidsAlvo.Contains([int]$wpid)) { $achada = $h; break }
        }
        $h = $U32::GetWindow($h, $GW_HWNDNEXT)
      }
    } catch { LogJanela ("erro na varredura: " + $_.Exception.Message) }
    return $achada
  }

  # A janela pode não existir ainda: tenta por ~15 s
  $hwnd = [IntPtr]::Zero
  for ($t = 0; $t -lt 60; $t++) {
    $hwnd = AcharJanela
    if ($hwnd -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 250
  }

  if ($hwnd -eq [IntPtr]::Zero) {
    LogJanela "FALHOU: nenhuma janela encontrada em 15s"
  } else {
    LogJanela ("janela encontrada: hwnd=" + $hwnd)

    # ---- Área de trabalho do monitor (desconta a barra de tarefas) ----
    $rc = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(16)
    $L=0; $T=0; $R=1280; $B=800
    try {
      if ($U32::SystemParametersInfoW($SPI_GETWORKAREA, [uint32]0, $rc, [uint32]0)) {
        $L = [System.Runtime.InteropServices.Marshal]::ReadInt32($rc, 0)
        $T = [System.Runtime.InteropServices.Marshal]::ReadInt32($rc, 4)
        $R = [System.Runtime.InteropServices.Marshal]::ReadInt32($rc, 8)
        $B = [System.Runtime.InteropServices.Marshal]::ReadInt32($rc, 12)
      }
    } finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($rc) }
    LogJanela "area de trabalho: $L,$T,$R,$B"

    # ---- Amarra o tamanho de restauração à área de trabalho inteira ----
    # WINDOWPLACEMENT = 11 inteiros (44 bytes):
    #  0 length | 4 flags | 8 showCmd | 12,16 ptMin | 20,24 ptMax | 28..40 rcNormal
    $wp = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(44)
    try {
      [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 0, 44)
      if ($U32::GetWindowPlacement($hwnd, $wp)) {
        $antesShow = [System.Runtime.InteropServices.Marshal]::ReadInt32($wp, 8)
        $an = @(28,32,36,40 | ForEach-Object { [System.Runtime.InteropServices.Marshal]::ReadInt32($wp, $_) })
        LogJanela ("placement ANTES: showCmd=$antesShow rcNormal=" + ($an -join ','))

        [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 8,  $SW_SHOWMAXIMIZED)
        [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 28, $L)   # left
        [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 32, $T)   # top
        [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 36, $R)   # right
        [System.Runtime.InteropServices.Marshal]::WriteInt32($wp, 40, $B)   # bottom
        $okwp = $U32::SetWindowPlacement($hwnd, $wp)
        LogJanela ("placement DEPOIS: rcNormal=$L,$T,$R,$B aplicado=$okwp")
      } else { LogJanela "GetWindowPlacement falhou" }
    } finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($wp) }

    # ---- Remove o botão do meio ----
    $estilo = $U32::GetWindowLongW($hwnd, $GWL_STYLE)
    LogJanela ("estilo ANTES = 0x{0:X8}" -f $estilo)
    if ($estilo -band $WS_MAXIMIZEBOX) {
      $novo = $estilo -band (-bnot $WS_MAXIMIZEBOX)
      [void]$U32::SetWindowLongW($hwnd, $GWL_STYLE, $novo)
      [void]$U32::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_REDESENHAR)
      $conf = $U32::GetWindowLongW($hwnd, $GWL_STYLE)
      LogJanela ("estilo DEPOIS = 0x{0:X8} | botao removido = {1}" -f $conf, (($conf -band $WS_MAXIMIZEBOX) -eq 0))
    } else {
      LogJanela "WS_MAXIMIZEBOX ja estava ausente"
    }
  }
} catch {
  LogJanela ("EXCECAO: " + $_.Exception.Message)
}

Log-Rede 'EXTENSAO' ("iniciada pid=$PID app=$ppid")
Enviar-Evento 'rede.extensao.pronta' @{ ok = $true; v = 2 }

# laco principal
$logErro = Join-Path $PSScriptRoot 'erro.log'
while ($ws.State -eq 'Open') {
  try {
    # espera curta por mensagem do sistema; depois esvazia o que já chegou
    if (Bombear-WS 15) { $k = 0; while ($k -lt 50 -and (Bombear-WS 0)) { $k++ } }
    if ($script:http) {
      while ($script:http -and $script:http.Pending()) { Nova-Conexao ($script:http.AcceptTcpClient()) }
      if ($script:conexoes.Count -gt 0) { Servir-Conexoes }
      Vencer-Pendentes
    }
    if ($script:impressoes.Count -gt 0) { Verificar-Impressoes }
    # Listener temporario para callback OAuth (porta 9741, aceita uma conexao)
    if ($script:oauthListener -and $script:oauthListener.Pending()) {
      $oauthCli = $script:oauthListener.AcceptTcpClient()
      try { $script:oauthListener.Stop() } catch {}
      $script:oauthListener = $null
      Tratar-OAuthCallback $oauthCli
    }
    Batimento
  } catch {
    Log-Rede 'ERRO-LACO' ([string]$_.Exception.Message)
  }
}
Log-Rede 'EXTENSAO' ("encerrada: conexao com o sistema " + $ws.State)
`;
