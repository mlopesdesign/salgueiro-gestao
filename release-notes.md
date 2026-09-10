## v3.25.41 — 2026-09-10

### 🔎 A busca do PDV não corta mais a lista

O cliente relatou que **produtos novos não apareciam no PDV**. Não era falta de atualização em tempo real — o cadastro entrava na hora. Era **corte na exibição**:

- a busca no servidor parava em **40** resultados;
- a tela do PDV mostrava só os **8 primeiros**;
- a ordem é **alfabética**.

Ou seja: numa loja com 120 blusas, pesquisar "blusa" trazia 40 e mostrava 8 — sempre as mesmas, do começo do alfabeto. Um produto recém-cadastrado caía na posição 121 e **nunca aparecia**, dando a impressão de que o cadastro não tinha salvo.

Agora **aparecem todos**, com rolagem e a contagem de resultados no topo da lista.

O mesmo corte foi retirado de:

- Consulta de preço (F3)
- Troca rápida e troca pela venda de origem
- Entrada de compras
- Busca de produtos na transferência entre estoques

### 🖼️ Fotos nas buscas amplas

A foto é convertida no servidor para ser exibida. Carregar centenas de uma vez traria de volta o travamento por excesso de imagens corrigido na v3.25.22. Por isso, numa busca ampla **só as 40 primeiras linhas trazem a foto** — as demais aparecem com o ícone padrão, mas continuam na lista e podem ser selecionadas normalmente. Digitando mais letras, a lista diminui e as fotos voltam.

### ✅ Entrada repartida — conferida

A entrada dividida entre vários estoques foi testada contra o banco real:

| Operação | Resultado |
|---|---|
| Entrada de 10 no Almoxarifado, 5 na Loja, 3 no WhatsApp | cada estoque ficou com exatamente o que foi escolhido |
| Total do Salgueiro | 18 — igual à soma dos locais |
| Saída de 5 da Loja | saiu da Loja, não trocou de estoque |
| Saída acima do saldo do local | recusada, com o saldo daquele estoque na mensagem |
| Ajuste de inventário | aplicado ao estoque contado |

Em todos os casos o total do Salgueiro continuou sendo a soma dos locais.

---

**Atualização:** baixe o `resources.neu` abaixo — o sistema aplica sozinho na próxima abertura.
