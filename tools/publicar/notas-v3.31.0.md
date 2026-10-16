## v3.31.0 — Rede sem fila · Diagnóstico de travamentos · Frete nas vendas com entrega

### 🌐 A loja pelo navegador não congela mais por causa do principal

O computador principal atendia os terminais **em fila de um só**. Enquanto ele:

- imprimia um cupom ou etiqueta (até **25 segundos**),
- esperava um relatório demorado, ou
- esperava uma conexão "de reserva" que o navegador abre sem mandar nada (até 5 s),

**todos os terminais ficavam parados**. Agora ele atende vários ao mesmo tempo e a impressão roda separada.

| Situação (teste com o servidor de rede) | Antes | Agora |
|---|---|---|
| Pedido com uma conexão de reserva aberta | 5,1 s | 0,3 s |
| 3 pedidos enquanto outro demorava 8 s | 7,7 s cada | 0,03 s cada |
| Pedido durante uma impressão de 6 s | esperava a impressão | 0,02 s |

### ⚠️ Aviso no terminal quando o principal não responde

Em vez de a tela simplesmente parar, aparece uma **faixa vermelha** — *"Sem resposta do computador principal desde HH:MM"* — que some sozinha quando a conexão volta. Nenhum pedido fica esperando para sempre: passou de 35 segundos, a tela avisa.

### 🩺 Diagnóstico de travamentos

O sistema passou a registrar o que acontece na rede, um arquivo por dia, guardado por 30 dias:

- cada pedido dos terminais, com endereço e tempo;
- o que demorou e o que ficou sem resposta;
- quando um terminal perdeu contato e quando voltou;
- quando o sistema abriu, fechou — ou caiu;
- backup na nuvem e impressões (os dois prendem o principal).

Para ver: **Configurações → Rede → Diagnóstico de travamentos**, escolhendo o dia. Dá para salvar em arquivo.

### 🚚 Frete nas vendas com entrega

Em **Configurações → Lojas**, marque **"Esta loja vende com entrega"** (loja WhatsApp). No pagamento:

- **Entrega** (obrigatória): Retirada no balcão, Mercado Envios, Correios, Motoboy, Transportadora ou Outro;
- **Valor do frete**, que soma no total da venda.

O frete aparece no **cupom**, no **fechamento do caixa**, no **relatório de vendas** (quantas entregas de cada tipo) e no **painel**. Entra no faturamento e no caixa — é dinheiro que entrou — mas **não no lucro**, porque é repassado a quem entrega. Também não vira preço de peça: devolução, troca e repasse de consignado continuam calculados só sobre as peças.

### Observação

No computador principal com o acesso em rede ligado, o sistema **reabre sozinho uma vez** logo depois da atualização, para o servidor de rede novo entrar no ar.
