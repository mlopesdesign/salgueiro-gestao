# v3.25.19 — Janela do PDV: abre maximizada e botão do meio desabilitado

## O que muda para a loja

- O programa volta a abrir sempre em tela cheia, em qualquer resolução de monitor.
- O botão do meio da barra de título (maximizar/restaurar) fica **desabilitado**. A funcionária não consegue mais clicar nele e bagunçar a tela do caixa. Continuam ativos apenas **_** (minimizar) e **X** (fechar).
- Minimizar e voltar pela barra de tarefas não faz mais a tela piscar nem sumir.
- Não aparecem mais janelas pretas de terminal durante a instalação nem ao abrir o programa.
- O instalador detecta a versão já instalada e pergunta antes de atualizar, preservando dados, vendas e configurações.

## Causas raiz corrigidas

Quatro defeitos independentes, todos silenciosos (nenhum gerava erro), que juntos mantiveram a janela quebrada da v3.25.13 à v3.25.18:

1. **Chave de configuração errada** — o config usava `maximized`, mas o Neutralino lê `maximize`. A opção era descartada sem aviso: a janela nunca abriu maximizada por configuração.

2. **`useSavedState`**, ligado por padrão, persistia o estado quebrado da janela em `.tmp/window_state.config.json` dentro da pasta do aplicativo. O arquivo **sobrevivia a desinstalar e reinstalar**, porque nem o instalador nem o desinstalador limpavam essa pasta. Por isso a v3.25.15 — código idêntico à v3.25.12, que funcionava — continuou abrindo minimizada.

3. **`resizable: false`**, usado na v3.25.13 para tentar remover o botão, remove o `WS_THICKFRAME`; sem esse bit o Windows não permite maximizar e a janela travava na barra de tarefas.

4. **`servidor-rede-embutido.js`** sobrescrevia o `servidor-rede.ps1` a cada inicialização, desfazendo no primeiro boot qualquer correção feita apenas no PS1.

## Implementação

- Remoção do botão via `SetWindowLong` retirando somente `WS_MAXIMIZEBOX`, preservando `WS_THICKFRAME`, `WS_MINIMIZEBOX` e `WS_SYSMENU`.
- P/Invoke declarado por `Reflection.Emit` em vez de `Add-Type`, que compila C# pelo `csc.exe` e abre consoles na tela do lojista.
- Janela localizada por varredura de Z-order filtrando por PID — `MainWindowHandle` retorna vazio no Neutralino.
- Contorno do [issue #1281 do Neutralino](https://github.com/neutralinojs/neutralinojs/issues/1281): `rcNormalPosition` amarrado à área de trabalho lida via `SPI_GETWORKAREA`, adaptando a qualquer resolução.
- Instalador: detecção reescrita com `${FileExists}` do LogicLib, checando registro HKCU/HKLM e 10 pistas em disco; `ExecShell` trocado por `nsExec`.

## Validação

- Detecção de versão anterior testada no Wine em 7 cenários, incluindo registro ausente e apenas restos em disco.
- Limpeza do `.tmp` confirmada em instalação real sob Wine.
- Sintaxe do PS1 validada no parser oficial do PowerShell; as 12 chamadas Win32 conferidas uma a uma; offsets do `WINDOWPLACEMENT` verificados.
- Cópia embutida do PS1 conferida byte a byte contra o arquivo original.
- Configuração final conferida dentro do `resources.neu` empacotado.

---

As versões 3.25.13 a 3.25.18 não receberam tag: eram intermediárias quebradas.

**Asset desta release:** `Salgueiro Gestao Setup v3.25.19.exe`
