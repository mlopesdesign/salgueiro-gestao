# REGRAS CRÍTICAS — LER ANTES DE QUALQUER COISA NESTE PROJETO

> Este arquivo existe porque eu (Claude) errei cada uma das regras abaixo pelo menos uma
> vez. Elas não são preferências: são condições para eu encostar no projeto.
> LER ESTE ARQUIVO E O ESTADO.MD É A PRIMEIRA AÇÃO DE QUALQUER SESSÃO.

---

## 1. NUNCA escolher versão sem conferir o que JÁ ESTÁ PUBLICADO no GitHub

**Errei em 16/09/2026.** Entreguei a v3.26.0 inteira — build, 5 lugares da versão,
release-notes, push-github.bat — e o GitHub recusou na publicação:

    v3.26.0 is used by another release

A tag já estava ocupada. O Marcio tinha **avisado antes** ("já existe a tag 26 no git") e
eu segui assim mesmo, porque tratei `git tag -f` como se resolvesse. Não resolve:
`-f` sobrescreve tag **local**, e não libera uma release já publicada no remoto.
Resultado: reempacotamento completo e entrega ao cliente atrasada.

**Antes de tocar em qualquer arquivo de versão:**

1. Abrir `https://github.com/mlopesdesign/salgueiro-gestao/releases` e `/tags`
2. Ler a **maior versão já publicada**
3. Escolher o próximo número a partir do que está **PUBLICADO** — nunca do que está no
   disco ou no ESTADO.MD, que podem estar atrás do remoto
4. Se o Marcio disser que uma tag já existe, isso é **PARADA IMEDIATA**: conferir o
   remoto antes de continuar
5. Só então: bump nos 5 lugares, `novidades.js`, `release-notes.md`, os DOIS
   `resources.neu`, `push-github.bat`

Número de versão é identidade pública e imutável. Uma vez publicada, está queimada para
sempre. Nenhum `-f` desfaz.

---

## 2. NUNCA entregar nada sem ponto de retorno

**Errei em 15/09/2026:** escrevi 11 arquivos no disco sem um único commit.

O mount da pasta está quebrado desde a atualização do Windows de 08/09 (KB5124008), então
eu **não consigo rodar git**. Isso não é desculpa — é o motivo de o mínimo ser:

- backup dos arquivos que vou tocar **ANTES** de tocar
  (o de 15/09 ficou em `backups\pre-v3.26.0-2026-09-15\`)
- o `push-github.bat` liga o auto-commit da pasta na primeira execução
  (`tools\auto-commit.ps1`, tarefa `SalgueiroAutoCommit`)

---

## 3. A RELEASE É PUBLICADA PELO VIGIA — NÃO PELO MARCIO, NÃO POR MIM À MÃO

**Mudou em 25/09/2026, decisão do Marcio:** *"Eu não aguento mais subir coisa pro
GitHub."* Ele escolheu: tudo automático, inclusive a Release.

**Como funciona:** o `tools\auto-commit.ps1` (nome antigo mantido porque é o que o
atalho da Inicializacao do Windows chama) virou o **vigia de publicação**. Roda no
Windows, com o login do git e o `gh` do Marcio, e a cada 30 s olha
`tools\publicar\pedido.json`.

**Ao fim de TODO build, depois do commit e da tag, eu gravo o pedido:**

```json
{ "tag": "vX.Y.Z", "titulo": "vX.Y.Z — ...", "asset": "Portable\\resources.neu",
  "notas": "release-notes.md", "sha256": "<sha256 do Portable\\resources.neu>" }
```

O vigia confere o sha256, confere que a versão NÃO está publicada, envia `main` e a
tag, cria a Release com o `.neu` e confere que o arquivo está lá. Resultado em
`tools\publicar\resultado.txt` — **eu leio esse arquivo e digo ao Marcio o que
aconteceu.** Pedido tratado vai para `feito\` ou `falhou\`, nunca fica em loop.

**REGRA NOVA (Marcio, 07/10/2026): EU PUBLICO SOZINHO. ELE NÃO CLICA EM NADA.**
*"Eu te contrato para fazer o trabalho por mim... Eu não vou trabalhar para você."*
O "dois cliques em PUBLICAR.bat" está REVOGADO — nunca mais pedir.

A cada versão:

1. Eu termino o build, comito, crio a tag e gravo `tools\publicar\pedido.json`.
2. **Eu mesmo rodo o vigia no Windows** pelo Desktop Commander (`start_process`, roda
   no Windows dele, que tem git e gh logados):
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\Projetos\LOJA FISICA SALGUEIRO V2\tools\auto-commit.ps1" -UmaVez`
   Saída esperada: **PRONTO - PUBLICADA** / `OK vX publicada`.
3. Eu confiro no GitHub (`/releases/tags/vX`): título, arquivo e tamanho.
4. Só então digo a ele que está publicado. **v3.30.0 foi a primeira publicada assim.**

Se o Desktop Commander não estiver disponível, aí sim explico por quê e só então
peço o clique — como exceção, nunca como rotina.

NÃO voltar a mandar título/notas para ele colar no GitHub. NÃO pedir reinício do PC.

**Continua proibido:** abrir o GitHub no navegador para publicar, e eu subir coisa
à mão. O caminho é o pedido. O shell do Claude não tem credencial do GitHub — só o
Windows tem, e é por isso que quem envia é o vigia.

**O vigia está vivo?** `tools\publicar\vigia-vivo.txt` é regravado a cada 30 s. Se
a hora dele estiver parada, o vigia não está rodando (liga no próximo login do
Windows).

## 4. MARCIO NÃO USA O PORTABLE

Há mais de 60 releases ele testa pelo **app instalado**, que se atualiza sozinho pela
Release do GitHub. Nunca dizer "rode o Portable para validar".
O `Portable\resources.neu` é o **asset** da Release — é de lá que o updater puxa.

---

## 5. MARCIO NÃO EXECUTA PASSO MANUAL

Nada de "rode este .bat", "clique aqui", "abra aquilo" enquanto houver caminho automático.
Quando for genuinamente impossível fazer sozinho, dizer **por que** é impossível — e não
transformar isso em tarefa para ele.

---

## 6. TROCA — NÃO MEXER (ordem de 15/09/2026, repetida 3x)

`trocas.js`, `devolucoes.js`, `vales_troca.js` e `src/js/pdv.js` ficam **intocados**.
Conferir por `diff` antes de empacotar e **dizer o resultado do diff**, não prometer.

Por isso a regra de saldo não-negativo NÃO está dentro de `estoques.aplicar()` — uma trava
ali mudaria troca e devolução. Existe `estoques.aplicarEstrito()`, chamada só na baixa da
venda, na correção pela grade e na importação. **Isso é proposital. Não "consertar".**

Bug conhecido e adiado a pedido dele: a troca grava linha em `vendas` e o `resumoCaixa`
soma tudo sem separar — o fechamento de caixa infla. O faturamento dos relatórios está
correto. Correção desenhada: `vendas.tipo_venda='troca'` (coluna já existe desde a
v3.19.0), separar no `resumoCaixa`, e dar nome a `'troca'` no mapa de formas de pagamento
em `relatorios.js:298`.

---

## 7. ESTADO.MD E GRAPHIFY.md

Ler os dois **ANTES** de qualquer ação. Atualizar os dois ao fim de toda sessão.
Ler de memória não conta — abrir o arquivo.
