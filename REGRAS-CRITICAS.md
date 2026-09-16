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

## 3. QUEM PUBLICA A RELEASE É SEMPRE O MARCIO

**Errei em 16/09/2026:** abri o GitHub e comecei a criar a release sozinho.

Eu entrego **tag, título, descrição e caminho do arquivo**. Só isso. Nunca abrir o GitHub
para publicar, nunca anexar asset, nunca clicar em Publish.

---

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
