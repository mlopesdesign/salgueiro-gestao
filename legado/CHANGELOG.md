# Salgueiro Gestão — Histórico de versões

## 1.0.4 — 2026-07-07
### Adicionado
- Instalador NSIS de volta, agora SEM asar: instala exatamente a mesma estrutura
  de pasta aberta do portable v1.0.3 (validado funcionando com dados reais).
  A tela branca do 1.0.1 ocorria somente no empacote asar no Windows.
- Instalado e portable compartilham os dados (%APPDATA%\Salgueiro Gestão) —
  migrar do portable para o instalado não requer backup/restauração.
### Pendente
- Atualização online: falta apontar a URL do VPS (publish.url no package.json)
  e publicar dist/latest.yml + Setup.exe a cada versão.

## 1.0.3 — 2026-07-07
### Corrigido
- **Dados "sumidos" no portable 1.0.2**: o productName havia perdido o acento
  ("Salgueiro Gestao"), o que muda a pasta de dados do Windows
  (%APPDATA%\Salgueiro Gestao em vez de %APPDATA%\Salgueiro Gestão).
  Nome restaurado para "Salgueiro Gestão" — o sistema volta a abrir o banco
  existente com todos os dados. Nenhum dado foi perdido em momento algum.

## 1.0.2 — 2026-07-07
### Alterado
- **Distribuição oficial passa a ser o PORTABLE** (pasta aberta, `asar` desativado),
  mesma estrutura da versão que sempre funcionou nas máquinas de teste.
- Instalador NSIS suspenso até conclusão do diagnóstico da tela branca do 1.0.1
  (código do renderer validado sem erros no runtime; suspeita em empacotamento asar
  × ambiente Windows).
- Gerado nativamente no Windows por `GERAR-PORTABLE-v1.0.2.bat` com smoke test
  obrigatório antes do empacote.

## 1.0.1 — 2026-07-07
### Corrigido
- **CRÍTICO**: app quebrava ao abrir quando o SQLite nativo não estava disponível.
  O fallback sql.js usava a API errada (`SQL.Database` de um módulo não inicializado
  → `TypeError` na inicialização). Reescrito com inicialização assíncrona correta.
- **CRÍTICO**: `main.js` empacotado continha bytes NUL no final do arquivo
  (corrupção de gravação) → `SyntaxError` imediato na abertura. Arquivo saneado e
  verificação de integridade (checksum + `node --check`) adicionada ao processo.
- Restauração de backup validava o arquivo apenas com better-sqlite3/node:sqlite;
  agora usa `validarBackup()` com a mesma cadeia de fallback do banco.

### Alterado
- **Removida definitivamente a dependência de compilação nativa** (better-sqlite3
  não é mais dependência). Cadeia do banco: `node:sqlite` (embutido no Electron 43,
  confirmado disponível) → better-sqlite3 (só se presente) → sql.js (JS puro).
  O instalador agora pode ser gerado em qualquer máquina SEM Visual Studio.
- `criarBanco()` é assíncrono; `main.js` e `test/smoke.js` adaptados.
- Persistência sql.js: gravação atômica (tmp + rename) com debounce de 300ms
  e salvamento garantido em `before-quit`.
- Versão 1.0.1 em `package.json`.

### Validação desta versão
- Smoke test (55+ verificações): ✅ Node 22 (node:sqlite) · ✅ Node 22 (sql.js)
  · ✅ Electron 43 runtime real (node:sqlite) · ✅ Electron 43 (sql.js)
- Boot do app no Electron 43: main.js executa até criação da janela, banco criado.
- 35 arquivos .js verificados: zero corrupção, zero erro de sintaxe.
- Conteúdo do app.asar auditado: main.js íntegro, sql.js e schema.sql presentes.

## 1.0.0 — 2026-07-07
- Versão anterior (portable). Quebrava ao abrir — ver correções da 1.0.1.

## 0.19.0 — 2026-07-07
- Primeiro instalador NSIS. Quebrava ao abrir (banco nativo ausente).
