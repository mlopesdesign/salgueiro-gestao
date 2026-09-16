## v3.26.5 — 2026-09-16

### 📐 Tela de Estoque alinhada

Cada loja virou uma **coluna de verdade**, com o número à direita e dígitos de largura
fixa — agora `9` e `11` batem na vertical. Antes os saldos eram texto solto dentro de uma
célula só, e nada se alinhava entre as linhas.

### 🔘 Entrada, Saída e Ajustar como botões empilhados

Os três viraram botões de mesma largura, um sobre o outro, com espaçamento igual entre
eles. A largura vem da própria coluna e o espaçamento é um `gap` único — não margem
solta, que é o que desalinhava quando um botão tinha texto mais curto.

### 📱 Responsivo

A tela se adapta ao tamanho do monitor. A rolagem horizontal fica **dentro da tabela** e
nunca empurra o layout da página. Em telas menores sai primeiro o código de barras (que
está na etiqueta e no leitor), depois a foto.

### 📷 Fotos de volta

Cada variação mostra a miniatura novamente. A linha do produto passa a usar **a primeira
foto que existir** entre as variações — antes pegava a da primeira variação da lista e, se
justamente aquela estivesse sem foto, o produto aparecia com o ícone genérico mesmo tendo
foto nas outras.
