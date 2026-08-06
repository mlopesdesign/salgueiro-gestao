# Sprint de 15 dias — MVP Boutique do Salgueiro

**Meta do dia 15:** loja vendendo com o sistema — produtos com grade, estoque, PDV com cupom e leitor, clientes/crediário e fechamento de caixa. Financeiro, compras e relatórios chegam por atualização automática nas 2–3 semanas seguintes.

| Dias | Entrega | Status |
|---|---|---|
| 1–2 | Fundação: app Electron, banco de dados completo, login e usuários | ✅ entregue (v0.1.0) |
| 3–4 | Produtos com grade (cor × tamanho), categorias, código de barras e etiquetas | ✅ entregue (v0.2.0) |
| 5–6 | Estoque: entradas, ajustes, kardex, alerta de mínimo | ✅ entregue (v0.2.0, adiantado) |
| 7–9 | PDV completo: venda com leitor, descontos, múltiplos pagamentos, cupom térmico, abertura/fechamento de caixa, sangria/suprimento | ✅ entregue (v0.3.0, adiantado) |
| 10–11 | Clientes + crediário (parcelas, recebimento, inadimplentes) | ✅ entregue (v0.4.0, adiantado) |
| 12 | Instalador .exe, backup automático, auto-update | 🔶 backup ✅ (v0.4.0); financeiro adiantado ✅ (v0.5.0); instalador/auto-update pendentes |
| 13–14 | **Testes na loja com hardware real** (impressora + leitor) e correções | |
| 15 | Treinamento da equipe e entrega | |

**Pós-entrega:** ✅ TUDO ENTREGUE ADIANTADO (v0.7.0) — fornecedores/compras, financeiro completo, relatórios com curva ABC, peças paradas e exportação CSV. Restam: instalador .exe/auto-update (dia 12) e testes com hardware real (dias 13–14).

**Features extras (pós-MVP):**
- ✅ v0.14.0 (05/07/2026) — Vale-troca: devolução gera código VT-XXXXXX resgatável no PDV, tela de gestão de vales, permissão `vales.ver`, 164 testes smoke passando.
- ✅ v0.15.0 (05/07/2026) — Programa de Pontos: acúmulo automático por venda, resgate como desconto no PDV, histórico por cliente, painel de configuração, 181 testes smoke passando.
- ✅ v0.16.0 (05/07/2026) — Categorias de Clientes + Importação/Exportação: categorias livres (CRUD admin), coluna categoria_id em clientes, filtro por categoria, importação de planilha Excel/CSV (deduplicação por CPF/nome, cria categorias automaticamente), exportação Excel e CSV, download de modelo de planilha, 209 testes smoke passando.
- ✅ v0.17.0 (05/07/2026) — Backup na Nuvem: Google Drive + OneDrive via OAuth 2.0 PKCE (sem client_secret), abre navegador para login, servidor HTTP local na porta 9741 captura callback, tokens em cloud_tokens.json, backup automático após fechar caixa ou diário quando ativo, máx. 30 backups, aba "☁️ Nuvem" em Configurações com status/conectar/desconectar/backup manual, 221 testes smoke passando.

## Papéis
- **Claude:** todo o código, banco, telas, instalador, correções.
- **Márcio:** testar cada versão no Windows, validar impressora/leitor na loja (dias 13–14), retorno da cliente.

## Riscos e mitigação
- **Impressora térmica:** modelo/porta só