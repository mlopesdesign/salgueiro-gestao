# Salgueiro Gestao - VIGIA DE PUBLICACAO (v3.27.5)
# ---------------------------------------------------------------------------
# Roda no Windows e sobe junto com o computador (atalho na pasta Inicializar,
# que chama ESTE arquivo - por isso o nome continua auto-commit.ps1).
#
# O que faz: a cada 30 segundos olha se existe tools\publicar\pedido.json.
# O Claude grava esse pedido quando termina um build. O vigia entao:
#   1. confere que o resources.neu e exatamente o do build (sha256)
#   2. confere que a versao ainda NAO foi publicada (versao publicada e
#      queimada: nunca sobrescreve)
#   3. envia o codigo (main) e a tag para o GitHub
#   4. cria a Release com titulo, notas e o resources.neu
#   5. confere que a Release ficou com o arquivo
# e escreve o resultado em tools\publicar\resultado.txt.
#
# Decisao do Marcio em 25/09/2026: a Release passa a ser publicada
# automaticamente. Ele nao abre mais o GitHub.
#
# POR QUE O VIGIA ANTIGO NUNCA FUNCIONOU: ele marcava "algo mudou" dentro do
# -Action do Register-ObjectEvent usando $script:ultima. Esse bloco roda num
# escopo proprio; o $script: dele nao e o do laco principal. O laco nunca via
# a marca e nunca commitou - zero commits de 16/09 a 25/09. Este aqui nao usa
# evento nenhum: so olha o arquivo a cada 30 s. Simples e sem esse furo.
#
# POR QUE NAO FAZ MAIS AUTO-COMMIT: o commit automatico disputava o .git com os
# commits feitos durante o trabalho e deixava HEAD.lock/index.lock para tras.
# Todo trabalho agora ja termina em commit; o vigia so publica.
#
# Este arquivo e ASCII puro de proposito: o PowerShell 5 le .ps1 sem BOM como
# ANSI e acento vira lixo.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
$RAIZ  = 'E:\Projetos\LOJA FISICA SALGUEIRO V2'
$REPO  = 'mlopesdesign/salgueiro-gestao'
$DIR   = Join-Path $RAIZ 'tools\publicar'
$PED   = Join-Path $DIR 'pedido.json'
$LOG   = Join-Path $DIR 'publicar.log'
$RES   = Join-Path $DIR 'resultado.txt'
$VIVO  = Join-Path $DIR 'vigia-vivo.txt'

# Uma copia so, mesmo se o atalho disparar duas vezes.
$mutex = New-Object System.Threading.Mutex($false, 'Local\SalgueiroVigiaPublicacao')
if (-not $mutex.WaitOne(0)) { exit 0 }

New-Item -ItemType Directory -Force -Path $DIR | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DIR 'feito') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DIR 'falhou') | Out-Null

function Agora { Get-Date -Format 'dd/MM/yyyy HH:mm:ss' }
function Log($t) { try { Add-Content -Path $LOG -Value ((Agora) + '  ' + $t) -Encoding UTF8 } catch {} }
function Resultado($t) { try { Set-Content -Path $RES -Value ((Agora) + "`r`n" + $t) -Encoding UTF8 } catch {} }

# O atalho da Inicializacao nem sempre herda o PATH completo do usuario.
# Procura git e gh no PATH e nos lugares de instalacao conhecidos.
function Achar($nome, $candidatos) {
  $c = Get-Command $nome -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $candidatos) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}
$GIT = Achar 'git' @(
  "$env:ProgramFiles\Git\cmd\git.exe",
  "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
  "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe")
$GH = Achar 'gh' @(
  "$env:ProgramFiles\GitHub CLI\gh.exe",
  "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
  "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe")

Set-Location $RAIZ
Log "=== vigia de publicacao iniciado | git: $GIT | gh: $GH ==="

function Rodar($exe, [string[]]$argumentos) {
  $saida = & $exe @argumentos 2>&1 | Out-String
  return @{ ok = ($LASTEXITCODE -eq 0); out = $saida.Trim() }
}

function Falhar($tag, $msg) {
  Log "FALHOU $tag : $msg"
  Resultado ("FALHOU $tag`r`n" + $msg)
  # Tira o pedido do caminho para nao ficar tentando em loop.
  try { Move-Item -Force $PED (Join-Path $DIR ('falhou\' + $tag + '.json')) } catch {}
}

function Publicar {
  $p = Get-Content $PED -Raw -Encoding UTF8 | ConvertFrom-Json
  $tag = [string]$p.tag
  if ($tag -notmatch '^v\d+\.\d+\.\d+$') { Falhar 'tag-invalida' "tag invalida no pedido: '$tag'"; return }
  if (-not $GIT) { Falhar $tag 'git nao encontrado neste computador.'; return }
  if (-not $GH)  { Falhar $tag 'gh (GitHub CLI) nao encontrado neste computador.'; return }

  $asset = Join-Path $RAIZ ([string]$p.asset)
  $notas = Join-Path $RAIZ ([string]$p.notas)
  if (-not (Test-Path $asset)) { Falhar $tag "arquivo da release nao existe: $asset"; return }
  if (-not (Test-Path $notas)) { Falhar $tag "notas da release nao existem: $notas"; return }

  # 1. o arquivo e exatamente o do build
  $sha = (Get-FileHash -Algorithm SHA256 -Path $asset).Hash.ToLower()
  if ($sha -ne ([string]$p.sha256).ToLower()) {
    Falhar $tag ("o resources.neu mudou depois do build. Nada foi publicado.`r`nno disco: $sha`r`nno pedido: " + $p.sha256)
    return
  }

  # 2. versao publicada e queimada
  $v = Rodar $GH @('release','view',$tag,'--repo',$REPO)
  if ($v.ok) { Falhar $tag "a Release $tag ja existe no GitHub. Versao publicada nao se sobrescreve."; return }

  Log "publicando $tag ..."

  # 3. codigo e tag
  $r = Rodar $GIT @('push','origin','HEAD:refs/heads/main')
  if (-not $r.ok) { Falhar $tag ("envio do codigo (main) recusado:`r`n" + $r.out); return }
  $r = Rodar $GIT @('push','origin',"refs/tags/${tag}")
  if (-not $r.ok) { Falhar $tag ("envio da tag recusado:`r`n" + $r.out); return }

  # 4. release
  $r = Rodar $GH @('release','create',$tag,$asset,'--repo',$REPO,'--title',[string]$p.titulo,'--notes-file',$notas,'--latest')
  if (-not $r.ok) { Falhar $tag ("criacao da Release falhou:`r`n" + $r.out); return }

  # 5. conferencia
  $c = Rodar $GH @('release','view',$tag,'--repo',$REPO,'--json','assets','--jq','.assets[].name')
  if (-not ($c.ok -and ($c.out -match 'resources\.neu'))) {
    Falhar $tag ("a Release foi criada mas nao tem o resources.neu:`r`n" + $c.out)
    return
  }

  Move-Item -Force $PED (Join-Path $DIR ('feito\' + $tag + '.json'))
  Log "OK $tag publicada"
  Resultado ("OK $tag publicada`r`nhttps://github.com/$REPO/releases/tag/$tag")
}

while ($true) {
  try { Set-Content -Path $VIVO -Value (Agora) -Encoding UTF8 } catch {}
  try { if (Test-Path $PED) { Publicar } } catch { Log ('erro inesperado: ' + $_.Exception.Message) }
  Start-Sleep -Seconds 30
}
