## v3.27.3 — Faturamento da troca corrigido nos relatórios

Na v3.27.0 a troca foi corrigida no **fechamento de caixa**, e só lá. A aba **Relatórios → Vendas** continuava somando o valor cheio: trocando uma peça de **R$ 80** por uma de **R$ 250**, o FATURAMENTO aparecia como **R$ 250,00** em vez dos **R$ 170,00** que a cliente realmente pagou.

Agora o relatório inteiro conta **só a diferença**:

- Faturamento e ticket médio
- Vendas por dia
- Vendas por vendedor(a)
- Vendas por hora
- Cartões **Vendas do Salgueiro** e **Vendas de consignados**

A conta deixou de estar repetida consulta por consulta e virou **uma regra única**, usada em todo o relatório — que é o que impede o problema de voltar na próxima tela que for criada.

Nada muda para venda normal, devolução, cortesia ou venda a preço de custo.
