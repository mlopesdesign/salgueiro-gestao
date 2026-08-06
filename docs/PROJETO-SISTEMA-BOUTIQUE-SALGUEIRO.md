# Projeto: Sistema de Gestão — Boutique do Salgueiro

**Versão do documento:** 1.0 · **Data:** 03/07/2026 · **Autor:** ML Lopes Design

---

## 1. Visão Geral

Sistema profissional de gestão completa para loja física, 100% em português brasileiro, instalável no Windows via instalador `.exe`. Funciona **offline** (banco de dados local), sem mensalidade e sem depender de internet para vender.

O projeto é um sistema **original**, inspirado nas melhores funcionalidades dos líderes de mercado brasileiros para varejo de moda (GestãoClick, Bling, Hiper, CPlug, MarketUP, Lexos), adaptado à realidade de uma boutique: **grade de produtos (cor/tamanho)**, crediário, coleções e atendimento personalizado.

**Nome sugerido:** `Salgueiro Gestão` (aceita sugestões)

## 2. Decisões já definidas

| Item | Decisão |
|---|---|
| Plataforma | App desktop instalável no Windows (offline-first) |
| Módulos | Todos: PDV, Produtos/Estoque, Clientes/Crediário, Financeiro, Fornecedores/Compras, Relatórios |
| Hardware | Impressora térmica de cupom (ESC/POS) + leitor de código de barras |
| Fiscal (NFC-e) | Módulo **opcional** — ativável na Fase 2 |

## 3. Arquitetura Técnica

### Stack recomendada

| Camada | Tecnologia | Por quê |
|---|---|---|
| Aplicativo | **Electron** | App nativo Windows com interface moderna; instalador .exe (NSIS) |
| Interface | **React + Tailwind CSS** | Telas rápidas, responsivas, fáceis de evoluir |
| Backend local | **Node.js** (embutido no Electron) | Uma linguagem só (JavaScript) em todo o projeto |
| Banco de dados | **SQLite** (better-sqlite3) | Arquivo local, zero configuração, rápido, backup = copiar 1 arquivo |
| Impressão térmica | **ESC/POS** via USB/rede | Padrão universal de impressoras de cupom (Epson, Bematech, Elgin...) |
| Leitor de código de barras | Modo teclado (plug-and-play) | Qualquer leitor USB funciona sem driver |
| Relatórios/PDF | Geração interna de PDF | Comprovantes A4, relatórios exportáveis |
| Atualizações | Auto-update via GitHub Releases | Mesmo pipeline já usado nos plugins ML Lopes |

### Princípios

1. **Offline-first:** tudo funciona sem internet; internet só para atualização e (futuro) NFC-e.
2. **Backup automático:** cópia diária do banco em pasta local + opção de pasta externa/pendrive.
3. **Multiusuário com perfis:** Administrador (tudo), Caixa (vende, não vê lucro), Estoquista.
4. **Auditoria:** todo movimento registra usuário, data e hora.

## 4. Módulos do Sistema

### 4.1 Cadastro de Produtos
- Produtos com **grade cor × tamanho** (ex.: Vestido Midi → Preto/P, Preto/M, Vermelho/M...), cada variação com estoque e código de barras próprios.
- Categorias e subcategorias (Vestidos, Blusas, Calças, Acessórios...), marcas e **coleções** (Verão 2026, Inverno...).
- Código de barras EAN ou interno gerado pelo sistema + **impressão de etiquetas** com preço.
- Preço de custo, margem, preço de venda, preço promocional com vigência.
- Foto do produto, fornecedor vinculado, estoque mínimo por variação.

### 4.2 Estoque
- Entrada de mercadorias (por compra ou avulsa), saída, ajuste e **inventário** (contagem com leitor).
- Alerta de estoque mínimo e lista de reposição.
- Custo médio automático a cada entrada.
- Histórico completo de movimentações por produto (kardex).

### 4.3 PDV — Frente de Caixa
- Tela de venda rápida operada por **teclado e leitor** (atalhos F2 = buscar produto, F4 = cliente, F10 = finalizar...).
- Busca por código de barras, nome ou referência; seleção de grade (cor/tamanho) na hora.
- Descontos por item ou no total (% ou R$), com limite por perfil de usuário.
- **Pagamento múltiplo:** dinheiro (com troco), PIX, cartão débito/crédito com parcelas, crediário — combináveis na mesma venda.
- Impressão automática de **cupom não-fiscal** na térmica (ou PDF).
- **Troca e devolução** com vale-troca ou estorno.
- Venda condicional (peças levadas para experimentar, com controle de retorno).
- **Abertura e fechamento de caixa** com conferência cega, **sangria** e **suprimento**.
- Orçamento/pré-venda que vira venda com um clique.

### 4.4 Clientes e Crediário
- Cadastro completo (CPF, telefone/WhatsApp, endereço, aniversário, tamanhos preferidos).
- Histórico de compras e peças por cliente.
- **Crediário/fiado:** limite de crédito, parcelas com vencimento, recebimento parcial, juros opcionais.
- Lista de inadimplentes e cobrança (relatório + link de WhatsApp com mensagem pronta).
- Aniversariantes do mês (para ações de venda).

### 4.5 Fornecedores e Compras
- Cadastro de fornecedores (CNPJ, contato, condições).
- Pedido de compra → recebimento da mercadoria → entrada automática no estoque + conta a pagar gerada.
- Histórico de preços por fornecedor.

### 4.6 Financeiro
- **Contas a pagar e a receber** com categorias (aluguel, energia, fornecedor...) e recorrência.
- **Fluxo de caixa** diário/mensal (previsto × realizado).
- Fechamentos de caixa integrados ao financeiro.
- Taxas de cartão por bandeira/parcelamento (lucro líquido real).
- DRE simplificado mensal: vendas − custos − despesas = lucro.

### 4.7 Relatórios
- Vendas por período, vendedor, categoria, forma de pagamento.
- **Curva ABC** de produtos e clientes.
- Margem de lucro e ticket médio; comparativo entre meses.
- Estoque valorizado (a custo e a venda), peças paradas (sem giro há X dias).
- Exportação em PDF e Excel.

### 4.8 Fiscal — Módulo Opcional (Fase 2)
- Emissão de **NFC-e** integrada à SEFAZ-PE com certificado digital A1.
- Fica desativado por padrão; quando ativado, o cupom do PDV passa a ser fiscal.
- Contingência offline (emite depois se a SEFAZ cair).

### 4.9 Configurações e Segurança
- Dados da loja (nome, CNPJ, logo no cupom).
- Usuários, senhas e permissões por perfil.
- Configuração de impressora, gaveta de dinheiro e backup.
- Log de auditoria (quem deu desconto, quem cancelou venda...).

## 5. Banco de Dados — Modelo Principal

```
categorias ─┐
marcas ─────┼─► produtos ─► variacoes (cor, tamanho, cod_barras, estoque, custo)
colecoes ───┘                   │
fornecedores ─► compras ─► compra_itens ─► movimentos_estoque
clientes ─► vendas ─► venda_itens / venda_pagamentos
clientes ─► crediario_parcelas
caixas (abertura/fechamento) ─► caixa_movimentos (sangria/suprimento)
financeiro_lancamentos (pagar/receber)
usuarios ─► auditoria_log
```

## 6. Fases de Desenvolvimento

| Fase | Entrega | Conteúdo |
|---|---|---|
| **1** | Fundação | Estrutura do app, banco de dados, login/usuários, cadastro de categorias e produtos com grade |
| **2** | Estoque | Entradas, ajustes, inventário, etiquetas com código de barras |
| **3** | PDV | Frente de caixa completa, cupom térmico, abertura/fechamento, sangria |
| **4** | Clientes | Cadastro, histórico, crediário completo |
| **5** | Compras/Financeiro | Fornecedores, contas a pagar/receber, fluxo de caixa |
| **6** | Relatórios | Todos os relatórios + exportações |
| **7** | Polimento | Backup automático, instalador .exe, auto-update, manual do usuário |
| **8** *(opcional)* | Fiscal | NFC-e SEFAZ-PE com certificado A1 |

Cada fase gera uma versão instalável e testável na loja.

## 7. Requisitos do Computador

- Windows 10 ou 11 (64 bits), 4 GB RAM, ~500 MB de disco.
- Impressora térmica ESC/POS (USB) e leitor de código de barras USB.
- Internet apenas para atualizações e NFC-e (quando ativado).

## 8. Próximos Passos

1. **Aprovar este projeto** (ajustes bem-vindos: nome, módulos, prioridades).
2. Definir identidade visual (cores/logo da boutique no sistema e no cupom).
3. Iniciar a **Fase 1** — já posso começar a desenvolver nesta pasta do projeto.
