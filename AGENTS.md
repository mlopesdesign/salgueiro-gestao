# Padrão ML Lopes Design — aplicativos desktop

> Instrução que o agente lê antes de escrever qualquer linha. O Codex procura
> este arquivo pelo nome `AGENTS.md` na raiz do projeto — não precisa pedir nada
> no chat.
>
> **Para um projeto novo:** copie este arquivo para a raiz dele, com este mesmo
> nome. Para o Claude Code, o nome é `CLAUDE.md` — o conteúdo é o mesmo.
>
> Autor: ML Lopes Design — Marcio (mlopesdesign@gmail.com)
> Base: Salgueiro Gestão V2, em produção desde julho/2026.

---

## 0. REGRA ZERO — ler o ESTADO.MD antes de qualquer coisa

> **A primeira ação de toda sessão é abrir e ler `ESTADO.MD` na raiz do projeto.**
> Não é sugestão, não é "quando parecer útil": é automático, a cada chamada.
> Só depois de ler o ESTADO.MD é que se abre código, se audita ou se escreve.
>
> Ler também `GRAPHIFY.md` (mapa técnico) na sequência.
>
> Ao FIM da sessão, atualizar os dois — sem esperar o usuário pedir.
>
> Ler "de memória", ou confiar no que uma sessão anterior disse, não conta:
> tem que ser o arquivo do disco, agora.
>
> Motivo: sem esse ponto de partida as sessões repetem trabalho já feito,
> mexem em versões erradas e perdem pendências. Já aconteceu.

---

## 0.1 REGRA CRÍTICA — versão e publicação

> **Antes de escolher QUALQUER número de versão, abrir
> `https://github.com/mlopesdesign/salgueiro-gestao/releases` e `/tags` e ler a maior
> versão JÁ PUBLICADA.** O número sai do que está publicado no remoto — nunca do disco,
> nunca do ESTADO.MD, que podem estar atrás.
>
> Em 16/09/2026 entreguei a v3.26.0 inteira e o GitHub recusou:
> `v3.26.0 is used by another release`. O Marcio tinha avisado que a tag já existia e eu
> segui achando que `git tag -f` resolvia — não resolve: `-f` mexe na tag local, não
> libera release publicada. Custou o reempacotamento inteiro e atrasou a entrega ao cliente.
>
> Se o Marcio disser que uma tag já existe, é **PARADA IMEDIATA** — conferir o remoto antes
> de continuar.
>
> **Quem publica a release é SEMPRE o Marcio.** Eu entrego tag, título, descrição e o
> caminho do arquivo. Nunca abrir o GitHub para publicar nem anexar asset.
>
> **Nada é entregue sem ponto de retorno:** backup dos arquivos antes de tocar neles.
>
> Regras completas em `REGRAS-CRITICAS.md` na raiz — ler junto com o ESTADO.MD.

## 1. Tecnologia — obrigatória, não é sugestão

| Peça | O que é | Versão |
|---|---|---|
| **JavaScript** | A linguagem. ES2020+, módulos nativos (`import`/`export`) | — |
| **HTML + CSS** | Escritos à mão | — |
| **Neutralino.js** | Empacota como `.exe` do Windows | 6.3.0 |
| **WebView2** | Já vem no Windows, desenha a tela | — |
| **sql.js** | SQLite compilado para asm.js, roda dentro da janela | — |
| **Node.js** | Só no build e nos testes. **Não vai para o cliente** | 22+ |

### O que é PROIBIDO

- **TypeScript** — o dono do projeto lê e edita o código; nada que precise compilar
- **React, Vue, Angular, Svelte** ou qualquer framework de front-end
- **Electron** — quebrou uma versão anterior e está vetado
- **Webpack, Vite, Rollup, Babel** — nenhuma etapa de build no JavaScript
- **Tailwind ou qualquer CSS que precise de compilador**
- Dependências de npm no código que roda no cliente. Bibliotecas de terceiros
  entram como arquivo em `src/js/vendor/`, baixadas uma vez e versionadas.

O executável final tem que ficar em torno de 6 MB e rodar em Windows limpo,
**sem instalar runtime nenhum**.

---

## 2. Estrutura de pastas

```
projeto/
├── AGENTS.md                 ← este arquivo
├── GRAPHIFY.md               ← mapa técnico, gerado por script (nunca editar à mão)
├── neutralino.config.json    ← fonte de verdade da VERSÃO
├── src/
│   ├── index.html            ← página única. BOM UTF-8 + <meta charset>
│   ├── schema.sql            ← as tabelas
│   ├── css/
│   └── js/
│       ├── app.js            ← menu, permissões, roteamento de telas
│       ├── <tela>.js         ← uma por área do menu
│       ├── vendor/           ← bibliotecas de terceiros, arquivo fixo
│       └── backend/
│           ├── servidor.js   ← despacha canal → core, aplica permissões
│           ├── db.js         ← wrapper do sql.js + migrações
│           ├── ambiente.js   ← tudo que toca o sistema operacional
│           └── core/         ← REGRA DE NEGÓCIO PURA, um arquivo por assunto
├── docs/                     ← manual do usuário e guia rápido (.md + .pdf)
└── tools/graphify.js         ← gera o GRAPHIFY.md
```

### A regra que sustenta tudo

**A lógica de negócio fica em `src/js/backend/core/`, em funções puras que
recebem `db` como parâmetro.** Nada de DOM, nada de `window`, nada de Neutralino
dentro do core.

O motivo é prático: dá para testar cada regra com Node e SQLite de verdade,
sem abrir o programa. Foi assim que 115 asserções provaram que uma correção
funcionava antes de ela chegar no cliente.

Toda comunicação tela ↔ backend passa por uma função só:
`api('assunto:acao', dados)`.

---

## 3. Como trabalhar — regras do Marcio

### GRAPHIFY — obrigatório no início E no fim

`GRAPHIFY.md` é o mapa técnico do projeto, gerado por `tools/graphify.js`.

**No início da sessão, antes de ler qualquer código:** leia o `GRAPHIFY.md`. Ele
diz onde está cada coisa — módulos, rotas, tabelas, hooks — e evita você sair
caçando arquivo. Se não existir, gere antes de propor qualquer mudança.

**No fim, antes de fechar a entrega:** rode `node tools/graphify.js` de novo. Um
GRAPHIFY defasado é pior que nenhum, porque o próximo agente confia nele.

Não é etapa opcional nem "quando sobrar tempo". É a primeira e a última coisa.

### Diagnóstico

**Nunca teorizar, supor ou "achar".** Todo diagnóstico cita **arquivo e linha**.
Faltou informação para concluir? Pergunte. Não preencha a lacuna com hipótese.

> Um diagnóstico errado entregue com confiança custou os dados de um cliente
> em produção. Essa regra nasceu daí.

### Entrega

- O Marcio **não executa `.bat`, comando de terminal nem passo manual**. Entregue
  pronto. Só peça algo se for impossível fazer sozinho.
- **Sem downgrade. Sem versão intermediária quebrada.**
- **Arquivo completo**, nunca trecho solto para o usuário colar.
- Interface **100% em português**, escrita para quem não é técnico.
- **Toda mudança gera um instalável.** Nenhuma entrega é considerada feita sem o
  `Setup.exe` da versão gerado e copiado para `instalador/` com o número no nome
  (`Salgueiro Gestao Setup vX.Y.Z.exe`). Vale para correção de uma linha. O
  `resources.neu` sozinho serve para atualizar quem já tem o app instalado, mas
  não substitui o instalável — quem instala do zero precisa dele, e alguns
  defeitos (limpeza de arquivos fora do pacote, registro, atalhos) só o
  instalador corrige.

### Versão — a cada correção, sem exceção

Fonte de verdade única: `neutralino.config.json` → `"version"`.

| Tipo | Sobe | Exemplo |
|---|---|---|
| Correção de bug | patch | 2.0.0 → 2.0.1 |
| Funcionalidade nova | minor | 2.0.5 → 2.1.0 |
| Quebra de compatibilidade | major | 2.9.0 → 3.0.0 |

A versão aparece em **cinco** lugares e os cinco têm que bater:

1. `neutralino.config.json` → `"version"` (fonte de verdade)
2. fallback `APP_VERSION` em `src/js/app.js`
3. fallback em `src/js/backend/ambiente.js` → `versaoApp()`
4. `salgueiro-setup.nsi` → texto do diálogo e `DisplayVersion` do registro
5. bloco novo no topo de `src/js/novidades.js`

Confira os cinco com um `grep` antes de fechar a entrega. Versão dessincronizada
faz o instalador anunciar uma coisa e o app mostrar outra.

### Documentação — na mesma entrega, não depois

1. `docs/MANUAL-DO-USUARIO.md` — completo, para leigo: o que é, para que serve,
   passo a passo numerado, e uma linha na tabela de problemas comuns
2. `docs/GUIA-RAPIDO.md` — o do dia a dia, em uma folha
3. Regerar os PDFs com `python3 tools/gerar-manuais.py` — são **seis** arquivos,
   três por documento: A4 de leitura, revista A5 e o livreto A4 para imprimir
   (`-LIVRETO-IMPRIMIR-A4`). Depende de `pandoc`, `weasyprint`, `pypdf` e
   `pymupdf`; a VM montada na máquina do Marcio não tem rede, então rode no
   ambiente do agente e devolva os arquivos prontos
4. `node tools/graphify.js` — regera o mapa técnico (obrigatório, ver acima)
5. Bloco novo no topo de `src/js/novidades.js` (o "o que mudou" que o usuário lê)
6. Entrada nova em "Versões publicadas" neste arquivo

Tom dos manuais: frase curta, sem jargão, tabela quando houver comparação.
Explique **por que** existe, não só onde clicar.

### Antes de entregar

1. `node --check` em todo arquivo tocado
2. Cada comando do `schema.sql` roda isolado (o app divide o arquivo por `;` —
   **ponto-e-vírgula dentro de comentário parte o `CREATE TABLE` seguinte**)
3. Teste automatizado da regra que mudou, contra SQLite de verdade
4. Teste da migração sobre um banco no formato antigo
5. Nenhum erro de JavaScript no console

---

## 4. Banco de dados — as armadilhas

O sql.js carrega o banco inteiro na memória e **regrava o arquivo todo a cada
escrita**. Isso tem três consequências que já custaram caro:

- **Dado de alta frequência usa `runVolatil()`, nunca `.run()`.** Um polling de
  4 em 4 segundos com `.run()` multiplicou por mil as gravações e ajudou a
  apagar o banco de um cliente.
- **Gravação de arquivo é: temporário → renomeia o atual para `.old` → move →
  apaga o `.old`.** Nunca apagar antes de mover: existe uma janela em que o
  banco não existe, e se o processo morrer ali, acabou.
- **`filesystem.move` no Windows falha se o destino existir.** Por isso o `.old`.

Outras duas:

- **SQLite não altera `CHECK`.** Para aceitar um valor novo, a tabela precisa ser
  reconstruída. A guarda da migração tem que testar o valor **entre aspas** —
  sem elas, casa com nome de coluna parecido e a migração nunca roda.
- **O `blur` de um campo dispara antes de o foco chegar no próximo.** Se o
  handler redesenhar outra parte da tela, o elemento que o usuário acabou de
  clicar é destruído. Campo numérico: escute `input`, aceite vazio durante a
  digitação, normalize no `blur`.

Limite honesto da tecnologia: funciona bem até uns **50 mil registros**. Acima
disso, ou com muita gente escrevendo ao mesmo tempo, precisa de PostgreSQL e
servidor de verdade — outra arquitetura.

---

## 5. Janela do app — as armadilhas

Cinco defeitos independentes, todos **silenciosos** (nenhum gera erro). Custaram
sete versões em agosto/2026. Leia antes de encostar em qualquer coisa de janela.

**A chave é `maximize`, não `maximized`.** O config trazia `"maximized": true` e o
Neutralino descartava sem avisar. Chave inexistente em `modes.window` é ignorada
em silêncio — confira a lista oficial antes de inventar nome.

**`useSavedState` vem ligado e envenena a instalação.** O Neutralino grava
tamanho, posição e estado maximizado em `<pasta do app>/.tmp/window_state.config.json`
e recarrega no boot seguinte. Um estado ruim gravado ali **sobrevive a desinstalar
e reinstalar**, porque nem o Setup nem o desinstalador limpavam essa pasta. Foi o
que fez uma versão de código idêntico a uma que funcionava continuar abrindo
minimizada. Mantenha `"useSavedState": false` e o `RMDir /r "$INSTDIR\.tmp"` no
`.nsi`.

**`"resizable": false` impede maximizar.** Remove o `WS_THICKFRAME`, e sem esse bit
o Windows não deixa a janela ficar maximizada — ela trava na barra de tarefas e
nunca aparece. Para tirar o botão do meio use `WS_MAXIMIZEBOX`, nunca `resizable`.

**O PS1 embutido sobrescreve o PS1 do disco a cada boot.**
`garantirExtensaoRede()` grava `src/js/backend/servidor-rede-embutido.js` por cima
de `extensions/rede/servidor-rede.ps1` toda vez que o app sobe. Editar só o `.ps1`
não adianta: a mudança é revertida na primeira execução. Regere a cópia embutida
junto (escapando `\`, crase e `${`) e confirme que as duas são idênticas byte a
byte importando o módulo no Node.

**Não use `Add-Type` para declarar P/Invoke.** Ele compila C# chamando o `csc.exe`,
que abre janelas pretas de terminal na frente do lojista. Use `Reflection.Emit`
com `DefinePInvokeMethod` — puro .NET em memória. Em PowerShell 5.1 é
`[AppDomain]::CurrentDomain.DefineDynamicAssembly`; no 7 é o método estático de
`AssemblyBuilder`; tente os dois.

**Achar a janela:** `MainWindowHandle` do processo pai volta **vazio** no
Neutralino. Varra as janelas de topo por Z-order (`GetTopWindow` +
`GetWindow(GW_HWNDNEXT)`) filtrando por PID visível e com título.

**A janela some mas o ícone fica na barra de tarefas? É o `-32000`.** O WebView2
grava a posição/tamanho da janela (no `Local State` do EBWebView e no
`WINDOWPLACEMENT`) e, quando o monitor onde ela estava é desconectado ou a
resolução muda, o Windows manda a janela para `(-32000,-32000)` — um valor
**sentinela de "posição inválida"**, não minimizada. A janela existe, tem handle,
responde a mensagem — só não está em monitor nenhum. **`IsIconic()` e `IsZoomed()`
MENTEM** nesse estado (dizem `False`/`True` errado); só `GetWindowRect` conta a
verdade. Diagnostique sempre por `GetWindowRect`, nunca por `IsIconic`/`IsZoomed`.
Correção: `useSavedState:false` + `SetWindowPlacement` fixando o `rcNormalPosition`
na área de trabalho (`SPI_GETWORKAREA`) — conserta o retângulo de restauração, não
só a posição atual. E **nunca** salve a posição da janela à mão (localStorage): é
onde a posição inválida gruda. Para o caso de o monitor cair com o app aberto,
vale uma guarda em runtime que detecta `|x|>10000` e recentraliza/re-maximiza.
(Confirmado em dois apps Neutralino/WebView2 diferentes — é da base Chromium/Edge,
não de um projeto só.)

**Bug upstream:** [neutralinojs#1281](https://github.com/neutralinojs/neutralinojs/issues/1281),
aberto. Abrindo com `maximize:true` o `rcNormalPosition` nunca é inicializado, e
restaurar joga a janela para um tamanho degenerado. Contorne com
`SetWindowPlacement` amarrando o retângulo à área de trabalho lida de
`SystemParametersInfo(SPI_GETWORKAREA)` — assim adapta a qualquer resolução.

**Instalador NSIS:** não use salto relativo (`IfFileExists x 0 +2`) dentro de
blocos `${If}` — eles se desalinham quando se acrescenta checagem e a detecção
passa a falhar em silêncio. Use `${FileExists}` do LogicLib. A detecção de versão
anterior tem que checar registro (HKCU e HKLM, com e sem espaço no nome) **e**
pistas em disco; e `ExecShell` abre terminal, use `nsExec`.

**Diagnóstico:** o PS1 grava `%APPDATA%/SalgueiroGestao/janela.log` com PID, HWND,
área de trabalho lida e estilo antes/depois em hexa. Leia esse arquivo antes de
teorizar.

---

## 5b. SQLite no navegador (sql.js) — NUNCA guarde binário grande no banco

O app usa sql.js (SQLite compilado para o navegador). Guardar imagem/base64 nas
colunas do banco é armadilha séria: cada gravação chama `db.export()`, que
serializa o banco INTEIRO e precisa de um bloco de memória contíguo de ~2x o
tamanho do arquivo. No WebView2 do Windows essa alocação enorme falha por
fragmentação e o SQLite aborta com **"Aborted(OOM). Build with -sASSERTIONS"** —
mesmo em máquina 64-bit e mesmo que o Node aguente o mesmo banco sem erro (o
ambiente é que difere). Sintoma clássico: erro ao salvar/ajustar em lojas com
muitas fotos.

Regra: **binário (foto, PDF, logo do cliente) vai para ARQUIVO no disco**, na
pasta de dados protegida; o banco guarda só o nome do arquivo. O front recebe a
imagem resolvida pelo backend (uma função que lê o arquivo e devolve data URI),
então as telas e os terminais de rede não mudam.

Ao migrar fotos que já estão no banco: backup por CÓPIA DE ARQUIVO (não por
export — export estoura), extrair cada foto para arquivo, trocar a coluna pelo
nome, e por fim **`VACUUM`** — sem ele o arquivo continua do mesmo tamanho (o
SQLite não devolve as páginas liberadas sozinho). O VACUUM depois da migração é
barato porque os dados vivos já são pequenos. Migração idempotente (flag em
config) e nunca apague o base64 da linha antes de o arquivo estar gravado.

## 6. Build

```bash
npm config set prefix ~/.npm-global
npm install -g @neutralinojs/neu

# binários com curl — nunca `neu update`
curl -L -o neutralinojs.zip \
  https://github.com/neutralinojs/neutralinojs/releases/download/v6.3.0/neutralinojs-v6.3.0.zip
curl -L -o src/js/neutralino.js \
  https://github.com/neutralinojs/neutralino.js/releases/download/v6.3.0/neutralino.js

neu build --release      # → dist/<nome>/resources.neu
```

Atualizar o app no cliente = **trocar o `resources.neu`**. Nada mais.

PDFs dos manuais: `pandoc -f gfm -t html5 -s` → **WeasyPrint**.

---

## 7. Git

**Commit ao fim de cada sessão de trabalho.** Fora do repositório:
material bruto do cliente (fotos, vídeos, `.psd`), `node_modules/`, `dist/`,
binários que o build regenera.

Configure um remote. Repositório só local não é backup.

---

## Versões publicadas

<!-- A cada release, uma linha nova AQUI EM CIMA, explicando a causa raiz e a
     correção com arquivo e linha. Este histórico é o que impede o próximo
     agente de repetir um erro já pago. -->

- v1.0.0 (aaaa-mm-dd): release inicial

## Imported Claude Cowork project instructions
