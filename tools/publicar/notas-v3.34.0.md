## v3.34.0 — Recuperar vendas pela contagem do estoque · Cópias de segurança automáticas a cada 30 min

### 🧯 Recuperar as vendas perdidas (Estoque → Recuperar vendas)

Para as vendas de 23 a 25/10, que sumiram quando o computador desligou de repente. A prova que sobrou é o **estoque físico**: o que o sistema diz que tem, menos o que está na loja, é o que saiu.

1. Escolha a **loja** e conte as peças: **bipe o código** (cada bipe soma 1) ou digite a quantidade. Dá para filtrar por consignados e por fornecedor.
2. A coluna **Saiu** mostra a diferença na hora, e o topo mostra o total de peças e o valor.
3. Peças que não estão mais na loja: use **"Não contados da lista = 0"**.
4. **Ver lançamento** → informe a **data e hora**, uma descrição (ex.: *evento de 23/10*) e **como foi pago** (extrato da maquininha e caixa). O sistema confere se fecha.
5. **Para separar por evento:** lance primeiro só as peças do 1º evento (coluna *Lançar*); o restante da MESMA contagem fica para o próximo lançamento, com outra data.

Cada lançamento entra como **venda de verdade**: baixa o estoque, gera o repasse dos **consignados por fornecedor** e aparece nos **relatórios no período escolhido**, marcada como *VENDA RECUPERADA*. Só o administrador acessa. A contagem fica guardada no computador até ser lançada; dá para contar aos poucos.

### ⏱️ Cópias de segurança automáticas (gatilhos)

Com o sistema aberto, sempre que houve venda ou alteração, uma cópia é feita:

- **a cada 30 minutos**;
- **5 minutos depois da última venda**, que pega o fim do movimento mesmo se o PDV ficar esquecido aberto;
- ao **abrir** e ao **fechar o caixa**;
- ao **abrir** e ao **fechar o sistema**;
- depois de cada **lançamento de vendas recuperadas**.

Ficam as últimas **96** cópias (cerca de 2 dias de movimento), além das diárias. Cada cópia é conferida depois de gravada. Em Configurações → Backup aparece o motivo de cada uma e o que tem dentro, sem precisar abrir o arquivo.
