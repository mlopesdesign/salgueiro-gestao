## v3.38.0 — Falta de luz não apaga mais as vendas · Segunda cópia no pendrive

### 🛡️ Gravação que vai mesmo para o disco

O Windows dizia "gravado" e guardava os dados na memória por alguns segundos. Se faltasse luz nesse intervalo, o arquivo do banco ficava em branco (foi o que aconteceu em 27/10). Agora cada gravação só é dada como pronta depois de estar **fisicamente no disco**. Se a energia cair no meio, fica o arquivo antigo inteiro ou o novo inteiro, nunca um pela metade.

### 🔌 Segunda cópia num pendrive

Configurações → 💾 Backup → **🔌 Escolher o pendrive**. Toda gravação vai para o HD **e** para um pendrive que fica sempre espetado, junto com as cópias automáticas. Se o HD estragar, o pendrive tem os mesmos dados, no máximo alguns segundos atrás.
- A letra do pendrive mudou? O sistema o encontra sozinho.
- Tiraram o pendrive? Aparece uma faixa laranja no rodapé até ele voltar, e as vendas continuam salvas no HD.

### 🔍 Cópia estragada não é mais usada

Ao abrir, o banco é conferido página por página. Com defeito, o sistema volta sozinho para a cópia **íntegra** com mais vendas, do HD ou do pendrive. Se nenhuma cópia íntegra tiver todas as vendas, ele não troca nada sozinho: guarda o arquivo e avisa para chamar o suporte. Um arquivo com defeito também não pode mais ser restaurado por engano.

> A gravação direta no disco passa a valer **na segunda abertura** depois de atualizar (o servidor interno do sistema é renovado ao abrir).

## Arquivo
- `resources.neu` — SHA256: `86661244575c35513bb6b85d8fdc5e23e9407807c08b36cdc2a961fa6bac542c`
