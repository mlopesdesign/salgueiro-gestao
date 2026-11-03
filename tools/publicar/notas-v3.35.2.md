## v3.35.2 — Código de barras sem repetição e porta da rede que não fica presa

### 🏷️ O que estava errado nos códigos

O código de barras interno era o número da variação no banco. Na restauração de 25/10 voltou o backup de 23/10 13:52, que ia até a variação **600**. As peças cadastradas depois, a partir de 30/10, ganharam de novo os números 601 a 661, ou seja, os códigos **2000000006017 a 2000000006611**. Esses mesmos códigos já estavam impressos em etiquetas de roupas cadastradas entre 23 e 25/10. Resultado: duas roupas diferentes com a mesma etiqueta.

### ✅ Agora

- As **61 variações** criadas depois da restauração ganharam **código novo**, no mesmo formato EAN-13 de sempre (começando em 2000000100012). Um código por peça (cor + tamanho).
- O código não depende mais do número da variação. Sai de um **contador próprio** que só sobe, guardado no banco **e** num arquivo fora do banco. Restaurar um backup antigo não faz o código voltar e repetir.
- Se um banco antigo for restaurado depois disto, a mesma troca é refeita igual: as etiquetas novas já coladas continuam valendo.
- Antes da troca o sistema faz uma cópia de segurança automática (`antes-codigos`).

### 🖨️ Etiquetas a trocar

Em **Estoque › Etiquetas a trocar** fica a lista por local, com o código antigo, o novo e a quantidade certa: **uma etiqueta por peça do saldo daquele local, nem a mais nem a menos**.

| Local | Etiquetas | Variações |
|---|---|---|
| Loja Principal | 372 | 46 |
| Loja Camarote | 266 | 23 |
| Almoxarifado Central | 101 | 9 |
| **Total** | **739** | **60** |

*(números do banco da loja em 01/11. A tela mostra o saldo do dia.)*

- Imprimir todas do local, só as que faltam, ou a lista de conferência em A4.
- Cada linha pode ser marcada como trocada. A aba some quando terminar.

### ⚠️ Etiqueta antiga no caixa

Bipar uma etiqueta que ainda não foi trocada mostra **"Etiqueta antiga — não vale mais"** e não vende a peça errada.

### 🔌 Porta da rede

Quando o sistema fechava de mau jeito, o servidor da rede ficava esquecido segurando a porta, e era preciso trocar a porta nos terminais. Agora ele se desliga sozinho quando o sistema fecha, e ao abrir o sistema libera a porta se ela estiver presa por uma sobra dele mesmo. Se outro programa estiver usando a porta, a mensagem diz qual.

### 🧪 Testes

- `teste-codigos-restauracao.mjs`: 33 asserções com contas à mão, rodadas no banco real da loja.
- Porta: sobra antiga encerrada e porta 8799 religada no Windows.
