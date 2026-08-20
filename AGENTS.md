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

### Versão — a cada correção, sem exceção

Fonte de verdade única: `neutralino.config.json` → `"version"`.

| Tipo | Sobe | Exemplo |
|---|---|---|
| Correção de bug | patch | 2.0.0 → 2.0.1 |
| Funcionalidade nova | minor | 2.0.5 → 2.1.0 |
| Quebra de compatibilidade | major | 2.9.0 → 3.0.0 |

A versão aparece em três lugares e os três têm que bater: o config, o fallback
em `app.js` e o fallback em `ambiente.js`.

### Documentação — na mesma entrega, não depois

1. `docs/MANUAL-DO-USUARIO.md` — completo, para leigo: o que é, para que serve,
   passo a passo numerado, e uma linha na tabela de problemas comuns
2. `docs/GUIA-RAPIDO.md` — o do dia a dia, em uma folha
3. Regerar os dois PDFs
4. `node tools/graphify.js` — regera o mapa técnico
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

## 5. Build

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

## 6. Git

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
