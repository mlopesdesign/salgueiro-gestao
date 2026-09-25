# ESTADO DO PROJETO — Salgueiro Gestão V2

> Arquivo mantido à mão. Atualizar ao fim de cada sessão ou ao trocar de máquina.
> Não é gerado por script — é o mapa humano do que está pendente.

---

## 1. Situação geral

| Item | Valor |
|---|---|
| **Versão atual** | 3.27.5 |
| **Data do último build** | 2026-09-25 |
| **Máquina de trabalho** | Desktop — `E:\Projetos\LOJA FISICA SALGUEIRO V2` |
| **session-lock** | gravado em 2026-08-04 pelo desktop (D:) — pode estar desatualizado |
| **GRAPHIFY** | atualizado para 3.27.5 em 2026-09-25 ✓ (27 módulos core · 158 rotas · 37 tabelas) |
| **5 lugares da versão** | os 5 em 3.27.5 ✓ |

---

## 1.0 PUBLICAÇÃO AUTOMÁTICA — ligada em 2026-09-25

Decisão do Marcio: *"Eu não aguento mais subir coisa pro GitHub."* → tudo automático,
inclusive a Release. Regra 3 do `REGRAS-CRITICAS.md` reescrita.

- `tools\auto-commit.ps1` virou o **vigia de publicação** (ASCII puro, CRLF, sintaxe
  conferida com o parser do PowerShell 7). Olha `tools\publicar\pedido.json` a cada
  30 s e publica. Testado com git/gh falsos em 5 casos: publica certo; para ANTES de
  enviar se o `.neu` mudou, se a versão já existe ou se o GitHub recusa; nunca fica
  em loop. Vigia antigo guardado em `backups\pre-v3.27.5-2026-09-25\`.
- **Por que o vigia antigo nunca fez UM commit** (zero, de 16/09 a 25/09): o
  `$script:ultima` dentro do `-Action` do `Register-ObjectEvent` roda em escopo
  próprio; o laço principal nunca via a marca. O novo não usa evento.
- **Ativa no próximo login do Windows.** O processo antigo continua na memória até lá
  (inofensivo — nunca fez nada). Prova de vida: `tools\publicar\vigia-vivo.txt`.
- **`main` divergia do GitHub** — o repositório do site nasceu separado, só com um
  README. Unido com `merge -s ours --allow-unrelated-histories` (nenhum arquivo local
  mudou; README do site trazido). O push agora é direto, sem rebase. **NUNCA MAIS
  `git pull --rebase` neste projeto** — foi ele que apagou os 97 arquivos em 16/09.
- A pausa `tools\.pausar-autocommit` que eu esqueci ligada em 24/09 foi removida.

## 1.1 v3.27.5 — pronta no disco, PEDIDO DE PUBLICAÇÃO GRAVADO (2026-09-25)

| Campo | Valor |
|---|---|
| Tag | `v3.27.5` |
| Título | v3.27.5 — Lucro bruto da troca com a conta certa |
| Asset | `Portable\resources.neu` — 6.415.416 bytes — sha256 `5c37a8f5d020af3e7d302a430f073d75f3b07f17f658b8607bc2a6f8c004008f` |
| Notas | `release-notes.md` na raiz |

**Reprovação:** painel com LUCRO BRUTO −R$ 90,00. Na v3.27.4 tirei a troca da
RECEITA e esqueci do CUSTO: a peça que saiu na troca seguia dentro do CMV.
Zero de venda − 90 de custo = −90. **Meia correção é pior que nenhuma.**

**A conta certa da troca** (`dashboard.js`):

    custo líquido da troca = custo da peça que SAIU − custo da que VOLTOU
    lucro da troca         = diferença recebida − custo líquido
    lucro bruto do mês     = (receita de vendas − CMV de vendas) + lucro das trocas

A peça devolvida volta à prateleira, então o custo dela não é perda. E o CMV das
vendas passou a excluir `tipo_venda='troca'`; `mesDevol.custo_dev` passou a
excluir `devolucoes.tipo='troca'`, senão o custo da peça devolvida era abatido
duas vezes. `top_produtos` também ganhou `NAO_TROCA`.

**Conferência à mão do caso limpo** (está no teste, como comentário):
camisa 80 (custo 30) → camisa 250 (custo 90), cliente paga 170.
Entrou 80 + 170 = 250; saiu peça de custo 90; **lucro = 160** (50 da venda +
110 da troca). O sistema dá 160.

**ARMADILHA: eu escrevi a asserção errada antes de conferir a conta.** Esperava
110 e o sistema deu 160 — eu tinha esquecido o lucro da venda de origem. Quase
"consertei" código que estava certo. **Fazer a conta à mão ANTES de escrever a
asserção, e deixar a conta escrita no teste.**

**Verificação:** `teste-troca-caixa.mjs` — 61 asserções (caixa, relatório,
painel, lucro bruto e mais vendidos).

**Falhas pré-existentes da suíte**, iguais antes e depois: `teste-consignado-rel`
(26 OK / 6) e `teste-origem-vendas` (25 OK / 4).

---

## 1.1b v3.27.4 — histórico (2026-09-25)

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.27.4` |
| Título | v3.27.4 — Troca não é venda, em toda tela |
| Asset | `Portable\resources.neu` — sha256 `8ea576470ba4b77e195f7b73d7df2bc3486e59a412fce934b44327a5eb9db5e7` |
| Notas | `release-notes.md` na raiz |

### A REGRA, nas palavras do Marcio

> "troca não é venda"
> "se eu troco um produto de 80,00 por um de 250, entrou apenas 170"
> "a diferença tem que entrar como diferença de uma troca e não como uma venda"
> "ele pode até entrar no total no final, porque como é a mais é um lucro — mas
>  tem que entrar como troca"

Traduzido para o sistema, e vale em TODA tela:

1. **Contagem** — a troca NÃO conta como venda. Fora de "1 venda(s)", do ticket
   médio e de qualquer número de vendas.
2. **Dinheiro** — da troca entra só a DIFERENÇA, nunca o valor cheio da peça.
3. **Apresentação** — a diferença aparece em LINHA PRÓPRIA, identificada como
   troca, e só então soma no total geral. Nunca embutida em "vendas".

### Onde isso mora agora: `core/vendas-sql.js` (NOVO)

`NAO_TROCA(alias)` → filtro para contagem · `RECEBIDO(alias)` → dinheiro líquido
de devolução · `RECEBIDO_BRUTO(alias)` → dinheiro sem descontar devolução (painel,
que mostra devolvido em linha separada).

Usado por `pdv.js` (resumoCaixa), `relatorios.js`, `dashboard.js` e `financeiro.js`.
**NUNCA escrever `SUM(v.total)` ou `COUNT(*) FROM vendas` solto numa consulta nova.**

### Campos novos

| Onde | Campos |
|---|---|
| `resumoCaixa` | `trocas {qtd, credito, recebido}` · `total_vendas` (só venda) · `total_recebido` |
| `vendasPeriodo` | `resumo.trocas` · `resumo.qtd_trocas` · `resumo.total_geral` |
| `dashboard.resumo` | `hoje.trocas` · `mes.trocas` |

**ARMADILHA que custou uma rodada:** os três módulos REMONTAM o objeto de saída
escolhendo campo a campo (`return { resumo: { qtd, total, ticket, origem } }`).
Acrescentar coluna na query não basta — tem de acrescentar no `return` também,
senão o campo some sem erro nenhum.

### O erro que se repetiu 4 VEZES nesta semana

Estoque → largura de janela → faturamento → painel. Sempre o mesmo: **corrigi o
lugar reclamado em vez da regra.** A pergunta obrigatória antes de fechar
qualquer correção: **"isto é regra do sistema? quem mais faz essa mesma conta ou
tem esse mesmo comportamento?"** — e `grep` no projeto inteiro. Se for regra, ela
vai para um ponto comum (`modal()`, `app.css`, `vendas-sql.js`), nunca para a
tela apontada.

**Verificação:** `teste-troca-caixa.mjs` com 50 asserções — caixa, relatório e
painel, incluindo 80→250 (vendas 80 · troca 170 · total 250), troca de valor
igual (nada muda) e troca com excedente (sai por sangria).

**Falhas pré-existentes da suíte**, conferidas iguais antes e depois:
`teste-consignado-rel` (26 OK / 6) e `teste-origem-vendas` (25 OK / 4).

---

## 1.1b v3.27.3 — histórico (2026-09-25)

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.27.3` |
| Título | v3.27.3 — Faturamento da troca corrigido nos relatórios |
| Asset | `Portable\resources.neu` — sha256 `cf18c431c487045a6f56443286066ed4879f69c12f7b7776bcdbb06864f14698` |
| Notas | `release-notes.md` na raiz |

**Reprovação:** troca de 80 por 250 mostrava FATURAMENTO R$ 250,00 em Relatórios → Vendas.
Na v3.27.0 eu corrigi a troca **só no `resumoCaixa`**. O relatório tem a própria conta de
faturamento e continuou somando `vendas.total` sem separar troca.

**Correção:** `relatorios.js` ganhou `_recebido`, expressão SQL única no topo do arquivo:

```
CASE WHEN tipo_venda='troca'
     THEN soma dos venda_pagamentos com forma <> 'troca'
     ELSE v.total - devolvido END
```

Aplicada em TODAS as 11 consultas que falavam em faturamento (resumo, por dia, por
vendedor, evento, por hora, gasto por cliente) e nos 3 rateios por item
(`CAST(v.total AS REAL)/v.subtotal` → `CAST((_recebido) AS REAL)/v.subtotal`), que é o
que faz os cartões Salgueiro × consignado somarem o faturamento.

**NÃO recalcular `v.total - devolvido` solto numa consulta nova** — usar `_recebido`.
É por aí que o furo volta.

**Este é o MESMO erro pela terceira vez na mesma semana** (estoque, largura de janela,
faturamento): corrigi o lugar reclamado em vez da regra. Antes de fechar qualquer
correção, perguntar: **quem mais faz essa mesma conta / tem esse mesmo comportamento?**
e procurar no projeto inteiro (`grep`), não só na tela apontada.

**Verificação:** `teste-troca-caixa.mjs` subiu para 36 asserções — as 5 novas batem o
faturamento do relatório, por dia, por vendedor e a soma dos cartões de origem, com o
caso 80→250 valendo 170 (com o furo daria 580).

**Falhas pré-existentes da suíte** conferidas iguais antes e depois: `teste-consignado-rel`
(26 OK / 6) e `teste-origem-vendas` (25 OK / 4).

---

## 1.1b v3.27.2 — histórico (2026-09-25)

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.27.2` |
| Título | v3.27.2 — Nenhuma janela rola tendo espaço na tela |
| Asset | `Portable\resources.neu` — sha256 `2a3f9a7fd1074b4c3bb8dea97b749f2795807904631f2be95fa240ae614204f2` |
| Notas | `release-notes.md` na raiz |

**Reprovação da v3.27.1:** *"vc não fez o procedimento em todas as janelas como eu pedi"*.
Eu tinha corrigido a largura **dentro da tela de estoque**, tratando como defeito de uma
janela o que era uma REGRA do sistema. A Troca rápida continuava estreita e com rolagem.

**Correção:** `app.js` ganhou `ajustarLarguraModal(m)`, chamada dentro do próprio
`modal()` — o ponto por onde TODA janela do sistema passa. Ela mede o corpo e os
`.tab-scroll` internos; se houver estouro lateral, alarga a janela até caber, com teto
de 90% da largura da tela e `max-width:90vw`. Janela pequena não cresce.
Exportada também, porque tela que monta grade DEPOIS de a janela abrir
(`estoque.js:formMovimentoProduto`) precisa remedir ao fim da montagem.

**LIÇÃO — vale para toda reprovação de layout:** quando o Marcio aponta um defeito de
interface, a pergunta não é "onde conserto isso" e sim **"esse defeito é regra do
sistema?"**. Se for, a correção vai para o ponto comum (`modal()`, `app.css`), nunca
para a tela reclamada. Corrigir só a tela apontada é reprovação garantida na seguinte.

---

## 1.1b v3.27.1 — histórico (2026-09-25)

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.27.1` |
| Título | v3.27.1 — Consignado barrado na tela e janela de estoque no tamanho certo |
| Asset | `Portable\resources.neu` — sha256 `78f6b2b5dfc09522e9b3829ddd88565fb844c9a8863976e00fd149afc6dea517` |
| Notas | `release-notes.md` na raiz |

Conferido no GitHub antes de escolher o número: `v3.27.0` **está publicada** (o Marcio já
estava rodando ela), então rebuild exigia número novo. `v3.27.1` estava livre.

**Duas reprovações da v3.27.0, corrigidas aqui:**

| Reprovação | Correção |
|---|---|
| "pedi para retirar a possibilidade de venda de consignado a preço de custo" — a v3.27.0 só recusava no servidor, na hora de fechar a venda. O operador montava o carrinho inteiro para descobrir no fim. | `pdv.js`: o item do carrinho passou a carregar `consignado` (já vinha de `estoque:buscar`). Com o modo custo ligado a peça consignada não entra; com ela no carrinho o modo custo não liga. A trava do servidor continua. |
| Janela de Entrada/Saída/Ajuste abria estreita e com rolagem lateral tendo espaço sobrando. | `estoque.js`: a conta era `260 + 104×lojas`, que dava MENOS que os 640px padrão do modal. Agora `300 + 130×lojas`, limitado a 90% da janela e nunca menor que 640. |

**Regra de layout (Marcio, 25/09/2026):** janela não usa barra de rolagem tendo espaço na
tela. Antes de fixar largura de modal, conferir se o conteúdo cabe — 80–90% da janela é o
teto natural, não os 640px padrão.

---

## 1.1b v3.27.0 — publicada em 2026-09-24

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.27.0` |
| Título | v3.27.0 — Troca certa no caixa, estoque de todas as lojas numa tela só |
| Asset | `Portable\resources.neu` — sha256 `b08fdacfb63771e0f82dd726c1f1fa784bde644c6f9bd1bf99edb54660441cbd` |
| Notas | `release-notes.md` na raiz |

Conferido antes de empacotar: a maior tag publicada era `v3.26.5`; `v3.27.0` está livre.

**O que entrou:**

| Área | Mudança |
|---|---|
| `core/trocas.js` | A venda gerada pela troca nasce com `tipo_venda='troca'`, nas duas vias (com e sem venda de origem). É a marca que separa troca de venda daqui para a frente. |
| `core/pdv.js` (`resumoCaixa`) | Total do caixa = vendas normais **+ só a diferença recebida nas trocas**. A forma `troca` saiu da lista de formas recebidas; `por_loja` também ignora a troca. Novo bloco `trocas` {qtd, credito, recebido}. |
| `core/pdv.js` (venda a custo) | Peça consignada é RECUSADA em venda a preço de custo, com o nome da peça. |
| `core/estoques.js` | `zerar()` — zera o saldo de um local ou de todos; produtos intactos; movimento `ajuste` negativo no kardex por peça; `variacoes.estoque` recalculado como soma dos locais. Só admin. |
| `core/relatorios.js` | `_ROTULO_FORMA` ganhou `troca: 'Crédito de troca'` (saía cru). |
| `servidor.js` | Rota `estoques:zerar` (só-admin, perm `estoque.movimentar`) + migração `migr_tipo_venda_troca_v3270`, que marca as trocas já gravadas pelo texto da `obs`. |
| `estoque.js` | `formMovimentoProduto`: uma coluna por estoque, sem a coluna "tem aqui". Etiquetas somam quando a variação entra em mais de uma loja. |
| `configuracoes.js` | Aba `📦 Estoques` (só admin) com zerar uma loja / todas, confirmação digitando ZERAR. Bloco de ajuste da impressão do cupom na aba Impressoras, visível também em rede. |
| `impressao.js` (novo) | Medidas do cupom em dois níveis: padrão da loja (config) e ajuste só desta máquina (localStorage). Mesma medida vale para a impressão direta e para a do diálogo. |

**Decisões que NÃO podem ser "consertadas" por engano:**

- A troca continua gravando a venda nova com o total CHEIO da peça (R$ 250 no exemplo).
  Isso é de propósito: `venda_itens`, devolução em cadeia e o desconto herdado dependem
  desse formato. Quem separa dinheiro de crédito é o `resumoCaixa`, não o INSERT.
- O excedente devolvido em dinheiro continua saindo por `caixa_movimentos` como sangria.
  Não somar isso de novo no total de vendas — seria contar a saída duas vezes.
- A regra de saldo não-negativo segue em `aplicarEstrito()`, **fora** do `aplicar()`.
  Trocas e devoluções continuam passando pelo `aplicar()` original.

**Verificação:** `testes/teste-troca-caixa.mjs` (31 asserções — inclui o caso 80→250
provando que entram 170 e não 330) e `testes/teste-zerar-estoque.mjs` (37 asserções).
`teste-venda-custo.mjs` atualizado: documentava a regra antiga, em que consignado a
custo era aceito.

**Falhas pré-existentes na suíte** (não são desta versão — conferidas rodando os mesmos
testes no commit `c99dab5`): `teste-consignado-rel` (26 OK / 6 falhas) e
`teste-origem-vendas` (25 OK / 4 falhas). Outros 4 testes não rodam por um problema de
caminho com espaços no nome da pasta, também anterior.

**Backup antes das alterações:** `backups\pre-v3.27.0-2026-09-24\` (os dois `resources.neu`)
e `backups\pre-v3.27.0-2026-09-17\` (os arquivos da impressão do cupom).

---

## 1.0 INCIDENTE 2026-09-24 — rebase travado apagou 97 arquivos

Um `git pull --rebase` da sessão anterior parou no meio (o git não conseguiu apagar
`Portable/extensions/rede` porque o app estava aberto segurando os arquivos). O rebase
ficou pendente em `.git/rebase-merge` e 97 arquivos rastreados sumiram do disco —
ESTADO.MD, CLAUDE.md, GRAPHIFY.md, AGENTS.md e REGRAS-CRITICAS.md entre eles.

Como foi resolvido: salvar os arquivos alterados fora do repositório → remover os
`.lock` do `.git` → `git rebase --abort` → repor os arquivos salvos → commitar.

**Para não repetir:** fechar o Salgueiro Gestão antes de qualquer `git pull`/`rebase`,
e nunca deixar um rebase pendente entre sessões. Se `git status` mostrar dezenas de
` D` e existir `.git/rebase-merge`, é este incidente — NÃO recriar os arquivos à mão,
é só abortar o rebase.

---

## 1.1b v3.26.1 — histórico (2026-09-16)

> **ARMADILHA QUE JÁ CUSTOU UM REEMPACOTAMENTO:** a v3.26.0 foi construída inteira e o
> GitHub recusou na publicação — `v3.26.0 is used by another release`. A tag já estava
> ocupada por uma release anterior, e `git tag -f` NÃO resolve isso (mexe só na tag local).
> Por isso a versão virou 3.26.1. **Antes de escolher número de versão, abrir
> `/releases` e `/tags` no GitHub e ler o que já está publicado.** Ver `REGRAS-CRITICAS.md`.

**Dados da release (quem publica é o Marcio):**

| Campo | Valor |
|---|---|
| Tag | `v3.26.1` |
| Título | v3.26.1 — Estoque pelo produto, etiqueta das peças que entraram, fim do estoque negativo |
| Asset | `Portable\resources.neu` — sha256 `dc82208f22f3c3205efedec43b380352c91f787d384ddceaa58e0a1adc00a4d0` |
| Notas | `release-notes.md` na raiz |

**O que entrou:**

| Área | Mudança |
|---|---|
| `core/produtos.js` | Grade do produto editável por ADMIN. O número é o TOTAL da variação; a diferença vira movimento no Kardex. Entradas vão para o Almoxarifado Central. Devolve `entradas[]` para as etiquetas. |
| `app.js` | Campo de estoque liberado para admin (era `disabled`), aviso vivo da diferença sem redesenhar a grade, e prévia de etiquetas ao salvar. |
| `etiquetas.js` | `abrirEtiquetasLote(itens, {entrada:true})` — modo "só as peças que entraram". |
| `core/pdv.js` | Venda confere o saldo do LOCAL, não o total geral. Sem saldo = RECUSA com peça, local e quantidade. Removido o bloco que aplicava a baixa mesmo faltando peça. |
| `core/importar-vendas.js` | Mesma conferência por local, tudo-ou-nada, com a lista do que falta. |
| `core/estoques.js` | `aplicarEstrito()`, `conferirSaldo()`, `negativos()`, `mapaLocais()`. |
| `estoque.js` | Lista agrupada por produto com saldo por loja; Entrada/Saída do produto inteiro numa tela só. |
| `servidor.js` | Rota `estoques:mapaLocais` (permissão `estoque.ver`). |

**Decisões que NÃO podem ser "consertadas" por engano:**

- A regra de saldo não-negativo está em `aplicarEstrito()`, **fora** do `aplicar()`, de
  propósito — uma trava global mudaria troca e devolução, que o Marcio tirou do escopo
  em 15/09/2026 (ordem repetida 3x). `trocas.js` e `devolucoes.js` conferidos por `diff`
  como idênticos aos originais, inclusive dentro do bundle empacotado.
- Venda sem saldo **trava** (opção A escolhida pelo Marcio). Não foi feita descida
  automática do almoxarifado. Isso cria assimetria proposital: venda trava, troca não.

**Verificação:** `testes/teste-estoque-grade.mjs` — 32 asserções contra SQLite real.
Inclui o caso do furo antigo: venda de 5 numa loja com 2, tendo 15 no total geral, é recusada.

**Backup antes das alterações:** `backups\pre-v3.26.0-2026-09-15\` (18 arquivos, os dois
`resources.neu` inclusive). Restaurar = devolver os dois `resources.neu` de lá.

---

## 1.2 Bug conhecido, ADIADO a pedido do Marcio

A troca grava uma linha em `vendas`, e o `resumoCaixa` (`core/pdv.js`) soma
`SUM(total) FROM vendas WHERE caixa_id=?` sem separar troca — **o fechamento de caixa
infla**, mesmo sem dinheiro ter entrado. O faturamento dos relatórios está CORRETO
(subtrai devoluções). Correção já desenhada, NÃO aplicada:

1. `trocas.js` gravar `tipo_venda='troca'` (a coluna existe desde a v3.19.0)
2. `resumoCaixa` separar Vendas de Trocas
3. dar nome a `'troca'` no mapa de formas em `relatorios.js:298`, onde ela não existe
4. backfill pelas vendas com `obs` começando em `"Troca — venda origem #"`

---

## 2. Git — situação real

Commitado e tagueado até **v3.25.41**. O histórico voltou a acompanhar o disco.

Últimos commits:
- `v3.25.41` — fim do corte na busca do PDV (produto novo ficava invisível)
- `v3.25.40` — troca rápida + importação de vendas por planilha
- `v3.25.39` — fix da saída de estoque, entrada repartida, busca nos estoques, troca de loja no PDV
- `7c37a1e` — push-github.bat para v3.25.38
- `aa4061c` — v3.25.38

> **ATENÇÃO — nada da v3.26.1 está commitado.** O mount da pasta está quebrado desde a
> atualização do Windows de 08/09 (KB5124008 quebrou o Plan9 do Hyper-V), então esta
> sessão não teve `git` nenhum: os arquivos foram escritos direto no disco pela ponte de
> arquivos. O `push-github.bat` foi reescrito para commitar, tagear, enviar e — na
> primeira execução — ligar o `SalgueiroAutoCommit` (`tools/auto-commit.ps1`), que passa
> a commitar sozinho qualquer alteração na pasta 45s depois da última gravação.
>
> A correção do Windows (KB5129195, 14/09) **não se aplica a esta máquina**: build
> 26220.9472, canal Beta do Insider — ramo 26220, enquanto o pacote é do ramo 26200.
> Depende do próximo flight do Beta.

---

## 3. O que foi feito desde o último commit (3.25.20 → 3.25.34)

| Versão | Data | O que mudou |
|---|---|---|
| 3.25.20 | 2026-08-20 | Recibo consignado alinhado ao relatório + ajustes de estoque |
| 3.25.21 | 2026-08-20 | Tela de Estoque abre com lista completa em ordem alfabética |
| 3.25.22 | 2026-08-20 | **FIX CRÍTICO:** fotos foram para arquivos em `dados/fotos/` (fim do OOM no WebView2); ajuste de estoque sem travamento |
| 3.25.23 | 2026-08-22 | Transferência: levar tudo e selecionar vários produtos de uma vez |
| 3.25.25 | 2026-08-22 | Transferir tudo zera a origem + mostra quantidade na lista |
| 3.25.26 | 2026-08-25 | Foto opcional na lista de Produtos e Preços |
| 3.25.27 | 2026-08-25 | Foto opcional no Relatório de Estoque |
| 3.25.28 | 2026-08-25 | Fotos no catálogo + botão cancelar venda + trocas liberadas para todos os perfis |
| 3.25.30 | 2026-08-25 | Fix: desconto de consignado contado duas vezes |
| 3.25.31 | 2026-08-25 | Fix: catálogo voltou a sair com as fotos |
| 3.25.32 | 2026-08-26 | Reparo automático do vínculo foto ↔ produto no boot (fotos não somem mais após restore de backup) |
| 3.25.33 | 2026-08-26 | Fix do updater: troca o arquivo com o app fechado (antes voltava para versão anterior) |
| 3.25.34 | 2026-08-26 | Miniaturas de fotos na listagem do estoque por local (lazy-load) |
| 3.25.35 | 2026-08-31 | Fix OOM migração/reparo fotos; desconto à vista bloqueado com taxa; venda a custo bloqueia categoria; scroll PDV; variação excluída pode ser re-adicionada |
| 3.25.36 | 2026-09-02 | Filtros por fornecedor consignado no Estoque; badge de fornecedor na lista |
| 3.25.37 | 2026-09-02 | Filtro cascata consignado/fornecedor em Produtos e Estoque (SELECT dropdowns) |
| 3.25.38 | 2026-09-02 | Fix do filtro por fornecedor em Produtos (fornecedor_id ausente na API); filtro cascata em Estoques (locais) |
| 3.25.39 | 2026-09-04 | **Fix crítico:** saída de estoque caía no almoxarifado em vez de sair do local. Entrada repartida entre estoques; busca e filtro de zerados em Estoques (locais); troca de loja no PDV sem fechar o caixa |
| 3.25.40 | 2026-09-05 | Troca rápida (sem venda de origem); importação de vendas de planilha para a loja do WhatsApp |
| 3.25.41 | 2026-09-10 | Busca do PDV sem corte (produto novo não aparecia); fotos limitadas a 40 por busca para não estourar memória |

---

## 4. Correções pendentes

> Sessão 2026-08-31 — todos os bugs reportados pelo cliente foram corrigidos na v3.25.35.

- [x] OOM ao gravar/ajustar estoque (migração de fotos + reparo de vínculos)
- [x] Desconto à vista indevido quando forma de pagamento tem taxa (ex.: PIX com custo)
- [x] Venda a preço de custo: desconto de categoria não era bloqueado
- [x] Sem scroll na lista de sugestões do PDV
- [x] Variação excluída (soft-delete) bloqueava re-inserção com mesmo nome

**Próximos passos:**
- [x] `resources.neu` regerado nos DOIS lugares para v3.25.41
- [x] `node tools/graphify.js` para atualizar GRAPHIFY.md
- [x] git commitado e tagueado até v3.25.41
- [ ] **rodar `push-github.bat` no Windows** — envia commits/tags e cria as releases v3.25.39, .40 e .41
- [ ] recompilar o instalador com `makensis salgueiro-setup.nsi` (opcional; o updater usa o resources.neu)

---

## 5. Itens do backlog que continuam abertos

- **Migração `migr_mensagens_v310` ausente no `db.js`** — usuários com permissões
  personalizadas (JSON em `usuarios.permissoes`) ficam sem `mensagens.usar` e o
  chat não abre. Não afeta perfis padrão.
- **Impressão silenciosa do cupom** — aguardando nome da impressora do cliente.
- **Rede multiterminal no cliente** — **CAUSA RAIZ IDENTIFICADA (2026-09-11):** o
  `salgueiro-setup.nsi` roda com `RequestExecutionLevel user`, mas o
  `netsh advfirewall firewall add rule` EXIGE administrador — o `nsExec::Exec`
  falhava **em silêncio** e a regra `SalgueiroRede` nunca existiu na máquina do
  cliente. Corrigido no .nsi (agora `ExecShell "runas"` com UAC + `profile=any`).
  Para as instalações já feitas: rodar `DIAGNOSTICO-REDE.bat` (raiz do projeto)
  como administrador — ele audita tudo, cria a regra, tira a rede do perfil
  "Público" e salva `RELATORIO-REDE-SALGUEIRO.txt` na Área de Trabalho.
- **Teste visual E2E bloqueado** — sandbox sem GTK/WebKit. Substituto: jsdom.
- **Troca rápida não confere dupla devolução** — sem venda de origem não há
  `venda_itens` para comparar. O crédito é limitado ao preço de tabela e a peça
  volta ao estoque, então uma devolução repetida aparece como sobra no balanço.
  Quem precisa da garantia usa "Trocar pela venda de origem".
- **Importação de vendas exige caixa aberto** — as vendas entram no caixa do
  momento. Importar o movimento de ontem lança tudo no caixa de hoje.

---

## 6. Arquitetura — lembretes rápidos

- Fotos ficam em `%APPDATA%/SalgueiroGestao/dados/fotos/` — banco guarda só o nome.
- `servidor-rede-embutido.js` sobrescreve o PS1 a cada boot — editar os dois juntos.
- `runVolatil()` para dados de alta frequência (ping do chat etc.) — nunca `.run()`.
- `resources.neu` existe em DOIS lugares: raiz do projeto (dev/git) e `Portable/resources.neu` (distribuição).
  **Ambos devem ser atualizados a cada release** (o updater distribui o de `Portable/`).
- O instalador `Portable/Salgueiro Gestao Setup.exe` é binário compilado pelo NSIS — não é atualizado
  automaticamente. Recompilar com `makensis salgueiro-setup.nsi` no Windows a cada release.
- Build no sandbox: copiar para `/tmp/build-vXXX`, `neu build --release`, depois ícone com `peresed`.
- GRAPHIFY: rodar `node tools/graphify.js` ao fim de toda sessão com mudança estrutural.
- `estoque:buscar` devolve até 500 linhas, mas **só as 40 primeiras com foto** (as demais
  saem com `foto: null`). A foto vira base64 no servidor — resolver centenas de uma vez
  reintroduz o estouro de memória do WebView2 que a v3.25.22 corrigiu. Se for mexer no
  limite da lista, mexa no limite das FOTOS, não no da lista.

---

## 7. Histórico de máquinas

| Período | Máquina | Caminho |
|---|---|---|
| até ago/2026 | Laptop | `H:\Meu Drive\Projetos\LOJA FISICA SALGUEIRO V2` |
| atual | Desktop | `E:\Projetos\LOJA FISICA SALGUEIRO V2` |

> Experimento de sincronização via Google Drive encerrado: o sandbox Linux não
> monta unidades do Drive, então o `resources.neu` não saia do build.

