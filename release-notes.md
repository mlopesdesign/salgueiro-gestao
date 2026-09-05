## v3.25.40 — 2026-09-05

### 🔄 Troca rápida — a troca ficou simples

Antes, para fazer uma troca era preciso **achar a venda de origem**: escolher o período, procurar pelo número do cupom ou pelo nome da cliente, achar a venda na lista. Era o passo mais lento do balcão e o que mais dava errado — cupom perdido, data errada, venda feita em outro caixa.

Agora o **F6** abre direto a troca rápida:

1. **Bipa a peça que voltou** — ela entra no estoque e vira crédito.
2. **Bipa a peça que a cliente leva** — ela sai do estoque.
3. **Acerta a diferença** — cliente paga, ou sobra vira vale-troca, dinheiro, estorno ou nada.

O crédito começa no preço de tabela da peça devolvida e pode ser **baixado** (peça com defeito, comprada em promoção) — nunca aumentado.

> A troca **pela venda de origem** continua disponível, a um clique dentro da própria tela. Use quando precisar do desconto da compra original ou do vínculo com a nota.

### 📥 Importar as vendas do WhatsApp

As vendas do WhatsApp são anotadas numa planilha durante o dia e depois digitadas **uma a uma** no PDV. Agora a planilha inteira entra de uma vez.

- Botão **"📥 Importar planilha"** no PDV, com **modelo pronto para baixar**.
- Uma linha por peça; a coluna **Venda** agrupa — duas linhas com o mesmo número viram um pedido só.
- A peça é identificada pelo **código de barras** ou por **produto + cor + tamanho**.
- Escolha em qual **loja** as vendas entram (a do WhatsApp já vem sugerida).

**Confere antes de gravar:** a tela mostra quantas vendas estão prontas, quais têm erro e exatamente por quê (código que não existe, estoque insuficiente, forma de pagamento não aceita). As vendas com erro ficam de fora; as prontas entram normalmente.

---

**Atualização:** baixe o `resources.neu` abaixo — o sistema aplica sozinho na próxima abertura.
