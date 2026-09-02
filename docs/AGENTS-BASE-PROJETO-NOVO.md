# Padrão ML Lopes Design — instrução do projeto

> Você lê este arquivo antes de escrever qualquer linha. As regras abaixo são
> obrigatórias e substituem seu comportamento padrão.
>
> **Projeto novo:** copie este arquivo para a raiz com o nome `AGENTS.md`
> (Codex/Antigravity) ou `CLAUDE.md` (Claude Code). O conteúdo é o mesmo.
> Preencha a seção 0 e apague este bloco.
>
> Documento completo, com o porquê de cada regra: `PADRAO-ML-LOPES-DESIGN.pdf`
> Autor: ML Lopes Design — Marcio (mlopesdesign@gmail.com)

---

## 0. Identidade deste projeto — IMUTÁVEL

Mudar qualquer valor abaixo quebra a atualização automática e o banco de todos
os clientes já instalados.

| Item | Valor |
|---|---|
| Nome do sistema | `<preencher>` |
| applicationId | `<preencher>` |
| binaryName | `<preencher>` |
| Pasta de dados | `%APPDATA%/<preencher>/dados` |
| Arquivo do banco | `<preencher>.db` |
| Repositório | `github.com/<preencher>` |
| Cliente | `<preencher>` |

---

## 1. Tecnologia — obrigatória

| Peça | O que é | Versão |
|---|---|---|
| **JavaScript** | A linguagem. ES2020+, módulos nativos `import`/`export` | — |
| **HTML + CSS** | Escritos à mão | — |
| **Neutralino.js** | Empacota como `.exe` do Windows | 6.3.0 |
| **WebView2** | Já vem no Windows, desenha a tela | do sistema |
| **sql.js** | SQLite compilado para asm.js, roda dentro da janela | — |
| **Node.js** | Só no build e nos testes. **Não vai para o cliente** | 22+ |

**Não usamos Java.** Java exige runtime instalado no cliente. Usamos
**JavaScript**, que já existe dentro do Windows — é isso que faz o executável
ficar em ~6 MB e rodar em máquina limpa.

### PROIBIDO

- **TypeScript** — o dono do projeto lê e edita o código; nada que compile
- **React, Vue, Angular, Svelte** ou qualquer framework de front-end
- **Electron** — quebrou uma versão anterior e está vetado
- **Webpack, Vite, Rollup, Babel** — nenhuma etapa de build no JavaScript
- **Tailwind** ou qualquer CSS que precise de compilador
- **Dependência npm no código do cliente** — biblioteca de terceiros entra como
  arquivo em `src/js/vendor/`, baixada uma vez e versionada no Git

### Quando esta stack NÃO serve

Acima de ~50 mil registros, com várias pessoas escrevendo ao mesmo tempo, para
celular ou para SaaS multiempresa: **avise e proponha outra arquitetura.** Não
force o padrão. O que se aproveita nesses casos é a filosofia (seções 3, 5, 6),
não a lista de tecnologias.

---

## 2. Estrutura

```
projeto/
├── AGENTS.md / CLAUDE.md     ← este arquivo
├── GRAPHIFY.md               ← mapa técnico, gerado por script (nunca editar à mão)
├── neutralino.config.json    ← fonte de verdade da VERSÃO
├── src/
│   ├── index.html            ← página única. BOM UTF-8 + <meta charset> + viewport
│   ├── schema.sql            ← as tabelas
│   ├── css/
│   └── js/
│       ├── app.js            ← menu, permissões, roteamento de telas
│       ├── <tela>.js         ← uma por área do menu
│       ├── vendor/           ← bibliotecas de terceiros, arquivo fixo
│       └── backend/
│           ├── servidor.js   ← despacha canal → core, aplica permissão por rota
│           ├── db.js         ← wrapper do sql.js + migrações
│           ├── ambiente.js   ← tudo que toca o sistema operacional
│           └── core/         ← REGRA DE NEGÓCIO PURA, um arquivo por assunto
├── docs/                     ← manual e guia rápido (.md + .pdf)
└── tools/graphify.js         ← gera o GRAPHIFY.md
```

### A regra que sustenta tudo

**A regra de negócio mora em `core/`, em funções puras que recebem `db` como
primeiro parâmetro.** Sem DOM, sem `window`, sem Neutralino dentro do core.

Motivo prático: assim cada regra é testável com Node e SQLite de verdade, sem
abrir o programa.

Toda conversa tela ↔ backend passa por uma função só: `api('assunto:acao', dados)`.

**Permissão é verificada no backend**, por rota, antes de a regra rodar.
Esconder o botão é conforto, não segurança.

### Ordem de construção

```
schema.sql → core/ + testes → servidor.js (rotas) → telas → build → manual
```

Escrever a tela primeiro parece mais rápido e não é: a regra acaba dentro do
handler do botão e deixa de ser testável.

---

## 3. Como trabalhar

### Diagnóstico

**Nunca teorizar, supor ou "achar". Todo diagnóstico cita arquivo e linha.**
Faltou informação? **Pergunte.** Não preencha a lacuna com hipótese.

> Um diagnóstico errado entregue com confiança custou os dados de um cliente em
> produção. Esta regra nasceu daí.

| Inaceitável | Correto |
|---|---|
| "Provavelmente o filtro descarta a linha." | "`app.js:1279` filtra com `l.cor \|\| l.tamanho \|\| l.id` — sem variação os três são vazios, a linha nunca sai da tela." |

### Entrega

- O autor **não executa `.bat`, comando de terminal nem passo manual.** Entregue
  pronto. Só peça algo se for impossível fazer sozinho.
- **Sem downgrade. Sem versão intermediária quebrada.**
- **Arquivo completo**, nunca trecho solto para colar.
- Interface **100% em português**, escrita para quem não é técnico.

### Toda entrega contém

1. O sintoma, na voz de quem reportou
2. A causa raiz, com arquivo e linha (todas, se forem várias somadas)
3. A correção
4. **Por que passou despercebido até agora**
5. A verificação, com número de asserções
6. A lição, quando houver

---

## 4. Versão — a cada build, sem exceção

Fonte de verdade única: `neutralino.config.json` → `"version"`.

| Tipo | Sobe | Exemplo |
|---|---|---|
| Correção de bug | patch | 3.5.1 → 3.5.2 |
| Funcionalidade nova | minor | 3.6.0 → 3.7.0 |
| Quebra de compatibilidade | major | 2.9.0 → 3.0.0 |

Três lugares têm que bater: o config, o fallback em `app.js` e o fallback em
`ambiente.js`.

**Todo build que gera um `.neu` diferente exige bump ANTES do build** — inclusive
rebuild do mesmo dia. O updater só oferece versão **maior**: trocar o arquivo de
uma release publicada não atualiza ninguém.

---

## 5. Documentação — na mesma entrega, não depois

1. `docs/MANUAL-DO-USUARIO.md` — completo, **para leigo**: o que é, para que
   serve, passo a passo numerado, e uma linha na tabela de problemas comuns
2. `docs/GUIA-RAPIDO.md` — o do dia a dia, em uma folha
3. Regerar os dois PDFs
4. `node tools/graphify.js` — regera o mapa técnico
5. Bloco novo no topo do arquivo de novidades (o "o que mudou" que o usuário lê)
6. Entrada nova em "Versões publicadas" neste arquivo

Tom: frase curta, sem jargão, tabela quando houver comparação. Explique **por
que** existe, não só onde clicar.

**Leia o GRAPHIFY antes de mexer em qualquer coisa estrutural.**

---

## 6. Testes

Sem framework: um `.mjs` que roda com Node, abre SQLite de verdade e conta
asserções. O número vai na mensagem de entrega.

Em ordem de importância:

1. **O caminho MÍNIMO, não só o completo** — o bug mora no campo que ninguém
   preenche
2. **A migração sobre um banco no formato ANTIGO**, não sobre um banco novo
3. A regra que mudou, contra SQLite real
4. A tela, com jsdom, disparando eventos reais

**Reportar bug inexistente custa tão caro quanto não achar o real.** Antes de
reportar, confirme que o teste usa o mesmo formato de dado que a tela envia.

### Antes de entregar

1. `node --check` em todo arquivo tocado
2. Cada comando do `schema.sql` roda isolado
3. Teste da regra que mudou
4. Teste da migração sobre banco antigo
5. Nenhum erro no console
6. Versão batendo nos três lugares
7. Documentação e GRAPHIFY atualizados
8. Dados da release prontos (seção 8)

---

## 7. Banco — as armadilhas que já custaram dados

O sql.js carrega o banco inteiro na memória e **regrava o arquivo todo a cada
escrita** (debounce de 300 ms).

- **Dado de alta frequência usa `runVolatil()`, nunca `.run()`.** Um polling de
  4 em 4 segundos com `.run()` multiplicou por mil as gravações e ajudou a
  apagar o banco de um cliente.
- **Gravação de arquivo:** tmp → renomeia o atual para `.old` → move → apaga o
  `.old`. **Nunca apagar antes de mover** — existe uma janela em que o banco não
  existe, e se o processo morrer ali, acabou. No boot, reconstruir do `.old`/`.tmp`
  se o arquivo principal sumiu.
- **`filesystem.move` no Windows falha se o destino existir.** Por isso o `.old`.
- **SQLite não altera `CHECK`.** Reconstruir a tabela em transação, conferindo a
  contagem. A guarda da migração testa o valor **entre aspas** — sem elas casa
  com nome de coluna parecido e a migração nunca roda.
- **`;` dentro de comentário no `schema.sql` parte o `CREATE TABLE` seguinte.**
- **Validar backup é radiografar todas as tabelas essenciais** e exigir
  movimento. Contar só uma tabela deixa banco vazio passar por bom.

### Interface

- **O `blur` dispara antes de o foco chegar no próximo elemento.** Redesenhar a
  tela no handler destrói o elemento que o usuário acabou de clicar.
- **Campo numérico:** escute `input`, aceite vazio durante a digitação, normalize
  no `blur`/Enter. Escutar `change` e redesenhar mata o cursor.
- **`index.html` precisa de BOM UTF-8 + `<meta charset>`** — sem isso o WebView2
  quebra os acentos. Ao editar por script, reescreva o BOM à mão.
- **`<meta name="viewport">` sempre**, e inputs com `font-size:16px` (abaixo
  disso o iOS dá zoom sozinho ao focar).
- **Aviso nunca só por som** — há máquina sem som. Precisa de forma visual
  persistente.

---

## 8. Build e atualização online

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

O ciclo do updater, em ordem, sem pular etapa:

1. Consulta a última release no GitHub
2. Só oferece se a versão de lá for **maior**
3. **Backup obrigatório** — se falhar, **aborta a atualização**
4. Baixa com `curl.exe` (o `fetch` é bloqueado por CORS no WebView2)
5. `move /Y` sobre o `resources.neu`
6. **Grava o banco** antes de reiniciar (o restart mata escrita pendente)
7. `restartProcess()`

### Ao fim de todo build, forneça sem que peçam

```
Tag:    vX.Y.Z
Título: vX.Y.Z — descrição curta

## O que mudou
- item 1

## Como atualizar
1. Baixe o resources.neu abaixo
2. Substitua em %LOCALAPPDATA%\<Sistema>\resources.neu
3. Reinicie o aplicativo

Ou aguarde a notificação automática dentro do app.

## Arquivo
- resources.neu — SHA256: <hash>
```

PDFs dos manuais: `pandoc -f gfm -t html5 -s` → **WeasyPrint**.

---

## 9. Git

**Commit ao fim de cada sessão**, com mensagem que explica a causa raiz:

```
v3.5.2 — fix: estoque inicial do produto novo era descartado pelo filtro da tela
```

Branch única `main`, remote no GitHub. **Repositório só local não é backup.**

Fora do repositório: `node_modules/`, `dist/`, `*.log`, binários que o build
regenera e **material bruto do cliente** (fotos, vídeos, `.psd` — estouram
qualquer repositório).

Dentro, apesar de binários: o `resources.neu` de entrega e o banco inicial do
cliente — são artefatos de entrega, não subprodutos de build.

**O projeto fica em disco local.** Nunca em unidade de rede ou pasta sincronizada
de nuvem: o ambiente de build não monta esses caminhos e o trabalho trava.

---

## Versões publicadas

<!-- A cada release, uma linha nova AQUI EM CIMA: causa raiz e correção com
     arquivo e linha, por que passou despercebido, e a verificação. Este
     histórico é o que impede o próximo agente de repetir um erro já pago. -->

- v1.0.0 (aaaa-mm-dd): release inicial
