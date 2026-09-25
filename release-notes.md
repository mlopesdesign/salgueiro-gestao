## v3.28.0 — Troca não é venda, de uma vez por todas

Até aqui a troca era guardada no sistema **como se fosse uma venda**, e cada tela precisava lembrar de separá-la. O caixa foi corrigido, depois o relatório, depois o painel — e o **Relatório de Evento** continuava mostrando uma troca como *"1 venda de R$ 180,00"*.

### 🔁 A troca agora é guardada como TROCA

Com situação própria no banco. **Nenhuma tela conta troca como venda** — nem as que já existem, nem as que ainda forem criadas. Trocas antigas são convertidas sozinhas na primeira abertura, com conferência de todas as vendas antes e depois.

### 💰 Só o saldo entra — positivo ou negativo

Saldo da troca = **o que a cliente pagou a mais − o troco que a loja devolveu em dinheiro ou estorno**.

| Troca | Entra |
|---|---|
| Camisa de R$ 80 → camisa de R$ 180, cliente paga R$ 100 | **+ R$ 100**, como troca |
| Camisa de R$ 250 → camisa de R$ 80, loja devolve R$ 170 em dinheiro | **− R$ 170**, como troca |
| Camisa de R$ 80 → outra de R$ 80 | **nada** — fica só o registro |

Entra no total, mas **sempre em linha própria, identificado como troca** — nunca dentro de "vendas".

### 🧾 A venda original continua sendo venda

Quando a troca é feita pela venda de origem, a peça que volta **não desconta mais aquela venda**: o dinheiro dela não voltou para a cliente, virou crédito para a peça nova. Antes, com a venda e a troca no mesmo dia, o relatório mostrava menos dinheiro do que realmente entrou.

### 📋 Onde aparece

- **Relatório de Evento:** cartão *Trocas*; seção *Trocas do período* com o que voltou, o que saiu, crédito, quanto pagou a mais, troco devolvido e saldo; fechamento em linhas separadas — *Líquido das vendas*, *Diferença das trocas*, *Líquido a receber*; nas formas de pagamento, o que foi pago nas trocas em linha própria para bater com a maquininha.
- **Fechamento de caixa:** Vendas → Trocas (pago a mais, troco devolvido, saldo) → Total recebido. A gaveta confere com o dinheiro das vendas **e** das trocas.
- **Relatórios e Painel:** trocas fora da contagem de vendas, com o saldo em linha própria.
- **Listas de vendas e histórico do cliente:** etiqueta *troca*.

### Conferido

Teste com o caso exato — camisa de 80 volta, cliente paga 100, leva camisa de 180 — e um dia inteiro com os quatro tipos de troca no mesmo caixa: o total recebido bate centavo a centavo com o dinheiro que entrou. A conversão do banco foi testada numa cópia real da loja: 723 vendas, R$ 104.423,99, 1.027 itens e 728 pagamentos idênticos antes e depois.
