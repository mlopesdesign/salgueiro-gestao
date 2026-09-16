# ESTADO DO PROJETO — Salgueiro Gestão V2

> Arquivo mantido à mão. Atualizar ao fim de cada sessão ou ao trocar de máquina.
> Não é gerado por script — é o mapa humano do que está pendente.

---

## 1. Situação geral

| Item | Valor |
|---|---|
| **Versão atual** | 3.26.1 |
| **Data do último build** | 2026-09-16 |
| **Máquina de trabalho** | Desktop — `E:\Projetos\LOJA FISICA SALGUEIRO V2` |
| **session-lock** | gravado em 2026-08-04 pelo desktop (D:) — pode estar desatualizado |
| **GRAPHIFY** | atualizado para 3.26.1 em 2026-09-16 ✓ (27 módulos core · 157 rotas · 37 tabelas) |
| **5 lugares da versão** | config, app.js, ambiente.js, novidades.js em 3.26.1 ✓ · **`.nsi` ainda em 3.25.41** ⚠ |

---

## 1.1 v3.26.1 — pronta no disco, FALTA PUBLICAR (2026-09-16)

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

