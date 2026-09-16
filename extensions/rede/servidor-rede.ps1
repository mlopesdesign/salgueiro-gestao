# Salgueiro Gestão V2 — extensão de acesso em rede (multiterminal)
# Servidor HTTP em PowerShell puro (nativo do Windows). Encaminha /api para o
# aplicativo principal via WebSocket do Neutralino; serve as telas aos terminais.
param()

$enc = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
trap {
  try { Add-Content -Path (Join-Path $PSScriptRoot 'erro.log') -Value ("[fatal] " + (Get-Date -Format s) + " " + $_.Exception.Message) } catch {}
  continue
}

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
$respostas = @{}
$script:tarefaWS = $null

function Bombear-WS([int]$timeoutMs) {
  if ($ws.State -ne 'Open') { return }
  if (-not $script:tarefaWS) {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$wsBuf)
    $script:tarefaWS = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
  }
  if (-not $script:tarefaWS.Wait($timeoutMs)) { return }
  $r = $script:tarefaWS.Result
  $script:tarefaWS = $null
  [void]$wsTexto.Append($enc.GetString($wsBuf, 0, $r.Count))
  if (-not $r.EndOfMessage) { return }
  $msg = $wsTexto.ToString(); [void]$wsTexto.Clear()
  $m = $null
  try { $m = $msg | ConvertFrom-Json } catch { return }
  if (-not $m -or -not $m.event) { return }
  try { Add-Content -Path $logErro -Value ("[ws-recv] " + (Get-Date -Format s) + " evt=" + $m.event) } catch {}
  if ($m.event -eq 'rede.resposta' -and $m.data -and $m.data.reqId) {
    $respostas[[string]$m.data.reqId] = ($m.data.corpo | ConvertTo-Json -Depth 14 -Compress)
  }
  elseif ($m.event -eq 'rede.iniciar')    { Iniciar-Http ([int]$m.data.porta) }
  elseif ($m.event -eq 'rede.parar')      { Parar-Http }
  elseif ($m.event -eq 'rede.ping')       { Enviar-Evento 'rede.pong' @{ ok = $true } }
  elseif ($m.event -eq 'rede.impressoras'){ Enviar-Evento 'rede.impressoras.resp' @{ impressoras = @(Listar-Impressoras) } }
  elseif ($m.event -eq 'rede.imprimir')   { Imprimir-Silencioso $m.data }
  elseif ($m.event -eq 'nuvem.oauthIniciar') { Iniciar-OAuthListener ([int]$m.data.porta) }
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

# Retorna o caminho do Edge instalado (sempre presente no Win10/11)
function Get-EdgePath {
  $paths = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($p in $paths) { if (Test-Path $p) { return $p } }
  # Fallback: busca no registro
  try {
    $reg = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -EA Stop).'(Default)'
    if ($reg -and (Test-Path $reg)) { return $reg }
  } catch {}
  return $null
}

# Localiza SumatraPDF portable: 1) bundled junto ao app, 2) baixado antes, 3) baixar agora
function Garantir-SumatraPDF {
  # 1. Bundled: instalado junto com o app na mesma pasta da extensão (sem precisar de internet)
  $bundled = Join-Path $PSScriptRoot 'SumatraPDF.exe'
  if (Test-Path $bundled) { return $bundled }
  # 2. Já baixado em sessão anterior
  $dest = "$env:APPDATA\SalgueiroGestao\tools\SumatraPDF.exe"
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

function Imprimir-Silencioso($dados) {
  $ok = $false; $erro = ''; $tmp = $null; $pdf = $null
  $logPath = "$env:APPDATA\SalgueiroGestao\impressao.log"
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
      $fileUrl = 'file:///' + $tmp.Replace('\', '/')

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
  Enviar-Evento 'rede.imprimir.resp' @{ ok = $ok; erro = $erro }
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
      $partes = $req.caminho -split '\?', 2
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

# servidor HTTP (TcpListener puro: nao exige administrador)
$script:http = $null
function Iniciar-Http([int]$porta) {
  Parar-Http
  try {
    $script:http = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $porta)
    $script:http.Start()
    Enviar-Evento 'rede.status' @{ ativa = $true; porta = $porta; ips = @(Listar-IPs) }
  } catch {
    $script:http = $null
    Enviar-Evento 'rede.status' @{ ativa = $false; erro = "Nao foi possivel abrir a porta $porta (ja esta em uso?)." }
  }
}
function Parar-Http {
  if ($script:http) {
    try { $script:http.Stop() } catch {}
    $script:http = $null
    Enviar-Evento 'rede.status' @{ ativa = $false }
  }
}

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
    if ($cabecalho.Contains("`r`n`r`n")) { break }
    if ($ms.Length -gt 1048576) { break }
  }
  $tudo = $ms.ToArray()
  $sep = $cabecalho.IndexOf("`r`n`r`n")
  if ($sep -lt 0) { return $null }
  $head = $cabecalho.Substring(0, $sep)
  $linhas = $head -split "`r`n"
  $req = @{ metodo = ($linhas[0] -split ' ')[0]; caminho = ($linhas[0] -split ' ')[1]; headers = @{} }
  foreach ($l in $linhas[1..($linhas.Count - 1)]) {
    $i = $l.IndexOf(':')
    if ($i -gt 0) { $req.headers[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() }
  }
  $clen = 0
  if ($req.headers['content-length']) { $clen = [int]$req.headers['content-length'] }
  $corpoIni = $sep + 4
  $corpoMs = New-Object System.IO.MemoryStream
  $ja = $tudo.Length - $corpoIni
  if ($ja -gt 0) { $corpoMs.Write($tudo, $corpoIni, $ja) }
  while ($corpoMs.Length -lt $clen) {
    $n = 0
    try { $n = $stream.Read($b, 0, [Math]::Min($b.Length, $clen - $corpoMs.Length)) } catch { break }
    if ($n -le 0) { break }
    $corpoMs.Write($b, 0, $n)
  }
  $req.corpo = $enc.GetString($corpoMs.ToArray())
  return $req
}

function Responder($stream, [int]$codigo, [string]$tipo, [byte[]]$corpo) {
  $st = 'OK'
  if ($codigo -eq 404) { $st = 'Not Found' } elseif ($codigo -ge 500) { $st = 'Error' }
  $h = "HTTP/1.1 $codigo $st`r`nContent-Type: $tipo`r`nContent-Length: $($corpo.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
  $hb = $enc.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if ($corpo.Length -gt 0) { $stream.Write($corpo, 0, $corpo.Length) }
  $stream.Flush()
}

function Tratar-Cliente($cliente) {
  $stream = $cliente.GetStream()
  $stream.ReadTimeout = 5000; $stream.WriteTimeout = 10000
  try {
    $req = Ler-Requisicao $stream
    if (-not $req) { return }
    if ($req.metodo -eq 'POST' -and $req.caminho -eq '/api') {
      $reqId = [Guid]::NewGuid().ToString('N')
      $token = ''
      if ($req.headers['x-token']) { $token = $req.headers['x-token'] }
      $canal = ''; $payload = $null
      try { $c = $req.corpo | ConvertFrom-Json; $canal = [string]$c.canal; $payload = $c.payload } catch {}
      Enviar-Evento 'rede.api' @{ reqId = $reqId; canal = $canal; payload = $payload; token = $token }
      try { Add-Content -Path $logErro -Value ("[api-send] " + (Get-Date -Format s) + " reqId=" + $reqId + " canal=" + $canal + " ws=" + $ws.State) } catch {}
      $limite = [DateTime]::UtcNow.AddSeconds(20)
      while (-not $respostas.ContainsKey($reqId) -and [DateTime]::UtcNow -lt $limite) { Bombear-WS 60 }
      try { Add-Content -Path $logErro -Value ("[api-done] " + (Get-Date -Format s) + " reqId=" + $reqId + " ok=" + $respostas.ContainsKey($reqId) + " ws=" + $ws.State) } catch {}
      if ($respostas.ContainsKey($reqId)) {
        $json = $respostas[$reqId]; $respostas.Remove($reqId)
        Responder $stream 200 'application/json; charset=utf-8' $enc.GetBytes($json)
      } else {
        Responder $stream 500 'application/json; charset=utf-8' $enc.GetBytes('{"ok":false,"erro":"Sem resposta do sistema principal."}')
      }
      return
    }
    $caminho = $req.caminho
    if ($caminho -eq '/') { $caminho = '/index.html' }
    if ($caminho.Contains('..')) { Responder $stream 404 'text/plain' $enc.GetBytes('nao'); return }
    try {
      # Baixar como bytes brutos para preservar UTF-8 (Invoke-WebRequest decodifica texto
      # usando o encoding do sistema Windows, que pode não ser UTF-8)
      $wc = New-Object System.Net.WebClient
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $conteudo = $wc.DownloadData("http://127.0.0.1:$nlPort" + $caminho)
      $tipo = $wc.ResponseHeaders['Content-Type']
      if (-not $tipo) { $tipo = 'application/octet-stream' }
      # Garantir charset=utf-8 em todos os tipos texto
      if ($tipo -match '^text/' -and $tipo -notmatch 'charset') {
        $tipo = $tipo + '; charset=utf-8'
      }
      if ($caminho -eq '/index.html') {
        $html = $enc.GetString($conteudo)
        $html = $html.Replace('<head>', '<head><script>window.__TERMINAL_REDE=1;</script>')
        $conteudo = $enc.GetBytes($html)
        $tipo = 'text/html; charset=utf-8'
      }
      Responder $stream 200 $tipo $conteudo
    } catch {
      Responder $stream 404 'text/plain; charset=utf-8' $enc.GetBytes('Arquivo nao encontrado.')
    }
  } catch {
  } finally {
    try { $stream.Close() } catch {}
    try { $cliente.Close() } catch {}
  }
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
$logJanela = "$env:APPDATA\SalgueiroGestao\janela.log"
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

Enviar-Evento 'rede.extensao.pronta' @{ ok = $true }

# laco principal
$logErro = Join-Path $PSScriptRoot 'erro.log'
while ($ws.State -eq 'Open') {
  try {
    Bombear-WS 40
    if ($script:http) {
      while ($script:http -and $script:http.Pending()) {
        $cli = $script:http.AcceptTcpClient()
        Tratar-Cliente $cli
      }
    }
    # Listener temporario para callback OAuth (porta 9741, aceita uma conexao)
    if ($script:oauthListener -and $script:oauthListener.Pending()) {
      $oauthCli = $script:oauthListener.AcceptTcpClient()
      try { $script:oauthListener.Stop() } catch {}
      $script:oauthListener = $null
      Tratar-OAuthCallback $oauthCli
    }
  } catch {
    try { Add-Content -Path $logErro -Value ("[laco] " + (Get-Date -Format s) + " " + $_.Exception.Message) } catch {}
  }
}
