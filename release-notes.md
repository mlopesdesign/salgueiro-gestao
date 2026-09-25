## v3.27.4 — Troca não é venda, em toda tela

O painel mostrava **"1 venda(s) · R$ 180,00"** para uma operação que foi uma **troca**. O caixa já tinha sido corrigido na v3.27.0 e o relatório na v3.27.3 — o painel não. O problema ia sendo tapado num lugar e reaparecendo em outro.

### 🔁 Troca deixou de contar como venda

Em lugar nenhum: painel, relatório, fechamento de caixa, gráfico dos 14 dias, ticket médio, vendas por dia, por vendedor(a), por hora, por loja, por categoria e os cartões Vendas do Salgueiro / Vendas de consignados.

### 💰 A diferença entra como troca, não como venda

O dinheiro que a cliente paga a mais **continua entrando no total** — entrou no caixa —, mas **identificado como troca**, em linha própria:

- **Fechamento de caixa:** Vendas → Trocas (crédito das peças que voltaram e diferença recebida) → **Total recebido**
- **Relatórios:** cartões **Diferença de trocas** e **Total recebido**, ao lado de Faturamento
- **Painel:** a diferença aparece embaixo do valor, sem entrar na contagem de vendas

Troca de peças do mesmo valor continua não mexendo em nada além do registro.

### 🧱 Virou uma regra só

A conta estava repetida em cada consulta do sistema — por isso era corrigida num arquivo e continuava errada nos outros. Agora existe um único lugar (`core/vendas-sql.js`) que define o que conta como venda e o que conta como dinheiro recebido, usado pelo caixa, pelo relatório, pelo painel e pelo financeiro.
