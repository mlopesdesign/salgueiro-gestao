# ESTADO DO PROJETO — Salgueiro Gestão V2

> Arquivo mantido à mão. Atualizar ao fim de cada sessão ou ao trocar de máquina.
> Não é gerado por script — é o mapa humano do que está pendente.

---

## 1. Situação geral

| Item | Valor |
|---|---|
| **Versão atual** | 3.25.40 |
| **Data do último build** | 2026-09-05 |
| **Máquina de trabalho** | Desktop — `E:\Projetos\LOJA FISICA SALGUEIRO V2` |
| **session-lock** | gravado em 2026-08-04 pelo desktop (D:) — pode estar desatualizado |
| **GRAPHIFY** | atualizado para 3.25.40 em 2026-09-05 ✓ |
| **5 lugares da versão** | todos em 3.25.40 ✓ (config, app.js, ambiente.js, .nsi, novidades.js) |

---

## 2. Git — situação real

Commitado e tagueado até **v3.25.40**. O histórico voltou a acompanhar o disco.

Últimos commits:
- `v3.25.40` — troca rápida + importação de vendas por planilha
- `v3.25.39` — fix da saída de estoque, entrada repartida, busca nos estoques, troca de loja no PDV
- `7c37a1e` — push-github.bat para v3.25.38
- `aa4061c` — v3.25.38

> **Falta apenas dar o push.** O sandbox Linux não tem as credenciais do GitHub;
> rodar `push-github.bat` no Windows envia commits, tags e cria a release.

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

---

## 4. Correções pendentes

> Sessão 2026-08-31 — todos os bugs reportados pelo cliente foram corrigidos na v3.25.35.

- [x] OOM ao gravar/ajustar estoque (migração de fotos + reparo de vínculos)
- [x] Desconto à vista indevido quando forma de pagamento tem taxa (ex.: PIX com custo)
- [x] Venda a preço de custo: desconto de categoria não era bloqueado
- [x] Sem scroll na lista de sugestões do PDV
- [x] Variação excluída (soft-delete) bloqueava re-inserção com mesmo nome

**Próximos passos:**
- [x] `resources.neu` regerado nos DOIS lugares para v3.25.40
- [x] `node tools/graphify.js` para atualizar GRAPHIFY.md
- [x] git commitado e tagueado até v3.25.40
- [ ] **rodar `push-github.bat` no Windows** — envia commits/tags e cria a release v3.25.40
- [ ] recompilar o instalador com `makensis salgueiro-setup.nsi` (opcional; o updater usa o resources.neu)

---

## 5. Itens do backlog que continuam abertos

- **Migração `migr_mensagens_v310` ausente no `db.js`** — usuários com permissões
  personalizadas (JSON em `usuarios.permissoes`) ficam sem `mensagens.usar` e o
  chat não abre. Não afeta perfis padrão.
- **Impressão silenciosa do cupom** — aguardando nome da impressora do cliente.
- **Rede multiterminal no cliente** — testar após firewall liberar porta 8750 TCP.
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

---

## 7. Histórico de máquinas

| Período | Máquina | Caminho |
|---|---|---|
| até ago/2026 | Laptop | `H:\Meu Drive\Projetos\LOJA FISICA SALGUEIRO V2` |
| atual | Desktop | `E:\Projetos\LOJA FISICA SALGUEIRO V2` |

> Experimento de sincronização via Google Drive encerrado: o sandbox Linux não
> monta unidades do Drive, então o `resources.neu` não saia do build.

