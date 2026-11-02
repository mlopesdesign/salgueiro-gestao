## v3.35.1 — Fechamento de caixa cego: só o administrador vê valores

### 🔒 O que estava errado

Ao fechar o caixa, **qualquer usuário** via todos os valores: total por forma de pagamento, total das vendas, trocas, consignados (custo, parte do fornecedor e da loja), dinheiro esperado na gaveta e a diferença no final. O fechamento nunca teve trava por perfil.

### ✅ Agora

- **Administrador:** vê o fechamento completo, como antes.
- **Demais usuários (caixa, estoque):** fechamento **cego**. A tela mostra só a loja e quando o caixa foi aberto, e pede o **dinheiro contado na gaveta** e observações. Nenhum valor aparece, nem o resultado depois de fechar: a mensagem é *"Caixa fechado. O administrador confere os valores."*
- A trava fica no **servidor**: para quem não é administrador, o sistema nem envia os números. Nem um terminal pelo navegador consegue pedir esses valores por fora.
- A diferença entre o contado e o esperado continua sendo calculada e gravada no caixa, para o administrador conferir.
