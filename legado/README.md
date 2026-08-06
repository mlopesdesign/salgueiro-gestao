# Salgueiro Gestão

Sistema de gestão da Boutique do Salgueiro — app desktop Windows, offline, em português.
Desenvolvido por ML Lopes Design.

## Rodar em desenvolvimento (Windows)

Requisitos: **Node.js 22.13 ou superior** (usa o SQLite embutido do Node — sem compilação nativa).

```bash
cd sistema
npm install
npm start
```

Login inicial: usuário **admin**, senha **admin123** (troque no primeiro uso).

O banco fica em `sistema/data/salgueiro.db` durante o desenvolvimento.
No app instalado, fica na pasta de dados do usuário (`%APPDATA%/salgueiro-gestao/dados`).

## Testes

```bash
npm test
```

Valida banco, login, usuários, categorias, produtos com grade, EAN-13, estoque inicial e auditoria — sem abrir a interface.

## Gerar o instalador (.exe)

```bash
npm run dist
```

Sai em `dist/SalgueiroGestao-Setup-<versão>.exe` (NSIS, com atalho na área de trabalho).

## Estrutura

```
sistema/
  main.js            processo principal (janela + rotas IPC)
  preload.js         ponte segura renderer ↔ main
  src/
    schema.sql       esquema completo do banco (todas as fases)
    db.js            abertura do banco + seed (node:sqlite, fallback better-sqlite3)
    core/            regras de negócio puras (testáveis sem Electron)
      util.js        senha (scrypt), EAN-13, auditoria
      auth.js        login, usuários, perfis
      produtos.js    categorias e produtos com grade cor×tamanho
  app/               interface (HTML/CSS/JS puro, sem build)
  test/smoke.js      teste de fumaça
```

## Roadmap (sprint de 15 dias)

Ver `../PLANO-15-DIAS.md`. Próximas entregas: estoque (entradas/ajustes/etiquetas), PDV completo com cupom térmico e caixa, clientes + crediário, instalador e backup automático.
