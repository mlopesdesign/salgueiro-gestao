# Projeto — Servidor, Terminais Satélites e Loja Virtual

**Salgueiro Gestão · ML Lopes Design · escopo para aprovação · 09/11/2026**
Base: v3.37.0 (publicada). Nada aqui foi codificado ainda.

---

## 1. Visão em uma figura

```
                         INTERNET (pode cair)
                               │
               ┌───────────────┴───────────────┐
               │   Loja virtual WordPress/Woo  │
               │   + plugin "ML Salgueiro Sync"│
               └───────────────▲───────────────┘
                               │ só o SERVIDOR fala com o site
                               │ (fila: se cair, espera e reenvia)
  ┌────────────────────────────┴────────────────────────────┐
  │  SERVIDOR — PC do escritório (o app atual, modo servidor) │
  │  banco único · regras · backups · fila da loja virtual    │
  └──────▲──────────────────▲──────────────────▲─────────────┘
         │ rede da loja (cabo) — NÃO usa internet
   ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
   │ Terminal 1│      │ Terminal 2│      │ Terminal N│   ← programa instalável
   │ PDV caixa │      │ Camarote  │      │  (novos)  │     "Salgueiro Terminal"
   └───────────┘      └───────────┘      └───────────┘
```

**Regra de ouro:** sem internet a loja abre e vende normalmente. A internet só
serve para conversar com o site; quando volta, a fila põe tudo em dia sozinha.

---

## 2. Servidor (PC do escritório)

O app atual **já é** o servidor (banco + regras + porta 8750). Não reescrevemos o
backend — ganha um **modo servidor**:

| Item | Como |
|---|---|
| Liga sozinho | Instalador cria atalho na Inicialização do Windows |
| Não para | Vigia (tarefa agendada) reabre o app se ele fechar ou travar |
| Não dorme | Instalador desliga suspensão/hibernação na tomada (`powercfg`, com UAC) |
| Fica fora do caminho | Abre minimizado; o X só minimiza (já é assim) |
| Painel do servidor | Tela nova: IP, porta, terminais conectados agora, última sincronização com o site, fila pendente |
| Ponto de retorno | Backup diário + cópia na pasta do Google Drive (já previsto) |

> Recomendado: servidor **no cabo** e IP fixo reservado no roteador. O PDV em
> Wi‑Fi isolado (192.168.15.51, visto em 05/11) não enxerga ninguém — terminal
> no Wi‑Fi de visitantes nunca vai conectar.

---

## 3. Terminal satélite — "Salgueiro Terminal"

Programa próprio (Neutralino + JS + NSIS), instalado em cada PDV. Substitui o Chrome.

| Item | Como |
|---|---|
| Acha o servidor sozinho | Varre a rede local na porta 8750 e reconhece o Salgueiro; guarda o IP; se mudar, procura de novo |
| Mesma tela de sempre | A interface vem do servidor → **atualizou o servidor, todos os terminais já estão na versão nova**. Não existe terminal "desatualizado" |
| Impressão silenciosa | Cupom e etiqueta na impressora **do próprio terminal** (SumatraPDF embutido), sem janela do navegador |
| Identidade | Cada terminal tem nome e loja/caixa próprios (regra atual: cada PDV no seu caixa) |
| Sem servidor | Faixa vermelha "sem conexão com o servidor" e bloqueio de fechar venda até voltar (já existe) |
| Atualização do próprio programa | Puxa do **servidor pela rede da loja** — não depende de internet nem de repositório público |
| Instalador | v1.0.0 já instalável, cria regra de firewall, atalho, abre maximizado |

Técnica a validar no protótipo: o programa local hospeda a tela do servidor e
recebe dela os pedidos de impressão. Se não passar no teste, plano B: cópia local
da interface sincronizada com o servidor a cada abertura.

---

## 4. Integração com a loja virtual (WooCommerce)

**Quem manda em quê:**

| Assunto | Dono | Direção |
|---|---|---|
| Estoque | PDV (servidor) | PDV → site |
| Cadastro de produto, preço, foto | PDV | PDV → site |
| Pedido do site | Site | site → PDV (vira venda da loja "Loja Virtual") |
| Ligação produto ↔ site | código de barras da variação = **SKU** no Woo | — |

**Como funciona:**

1. Toda baixa/entrada de estoque no PDV entra numa **fila** no banco.
2. O servidor envia a fila ao site a cada poucos segundos (lote). Sem internet,
   a fila só cresce; quando volta, envia tudo na ordem.
3. A cada 1–2 min o servidor busca pedidos novos do site, dá baixa no estoque
   e registra como venda da loja virtual (sai nos relatórios junto com as demais).
4. **Plugin "ML Salgueiro Sync" no WordPress** (feito por nós): recebe o estoque
   por SKU em lote, entrega os pedidos e protege contra venda do que não existe.

**Proteções contra vender o que acabou:**

| Proteção | O que faz |
|---|---|
| Estoque de segurança | O site mostra o estoque menos N peças (ex.: 1). A última peça fica para a loja física |
| Estoque próprio do site (opcional) | Um local "Loja Virtual" em Estoques; o site só vende o que foi transferido para ele |
| Servidor sumiu | Se o site ficar X minutos sem notícia do servidor, o plugin põe as peças com 1 unidade em "consultar disponibilidade" e reduz as demais pelo estoque de segurança |
| Corrida | Pedido do site que chegar sem estoque fica marcado "conferir" na tela do PDV, nunca some calado |

---

## 5. Fases e entregas

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Modo servidor (Inicialização, vigia, sem suspensão, painel) — nova versão do Salgueiro | — |
| 2 | Salgueiro Terminal v1.0.0 (instalador, descoberta, impressão local) — repositório privado próprio | Fase 1 |
| 3 | Fila + envio de estoque/produtos ao site + plugin ML Salgueiro Sync v1.0.0 | Site no ar (homologação) + chaves da API Woo |
| 4 | Pedidos do site entrando no PDV + proteções | Fase 3 |

Cada fase sai com backup antes, testes, instalador e ponto de retorno — a loja
não fica um dia sem PDV.

---

## 6. Decisões (recomendação entre parênteses — sigo com ela se não houver outra ordem)

1. **Servidor desligado:** terminais param até ele voltar **(sim — modo offline nos terminais é outro projeto, grande, com risco de venda dupla)**.
2. **Qual estoque o site enxerga:** total da loja com estoque de segurança **(recomendado)** ou só o local "Loja Virtual".
3. **Cadastro de produto:** só no PDV, enviado ao site **(recomendado)** ou nos dois, ligados por SKU.
4. **O PC do escritório continua vendendo?** **(não — vira só servidor; venda nos terminais)**.

Para a fase 3: endereço do site em homologação e acesso de administrador do WordPress.
