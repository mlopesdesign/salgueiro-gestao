#!/usr/bin/env node
// GRAPHIFY — gera o mapa técnico do Salgueiro Gestão a partir do código.
// Sem dependências externas. Rodar da raiz do projeto:
//     node tools/graphify.js
// Saída: GRAPHIFY.md na raiz.
//
// Padrão ML Lopes Design: a cada alteração estrutural, regerar este arquivo
// junto com os documentos em docs/.
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(process.argv[2] || '.');
const ler = (p) => { try { return fs.readFileSync(path.join(RAIZ, p), 'utf8'); } catch { return ''; } };
const existe = (p) => fs.existsSync(path.join(RAIZ, p));

// ── Coleta ──────────────────────────────────────────────────────────────────
function arquivosJs(dir) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.js'))
    .map(f => `${dir}/${f}`)
    .sort();
}

function analisa(rel) {
  const src = ler(rel);
  const linhas = src.split('\n').length;
  const exportados = new Set();
  // export function nome / export async function nome
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) exportados.add(m[1]);
  // export const nome
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g)) exportados.add(m[1]);
  // export { a, b, c }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const nome of m[1].split(',')) {
      const limpo = nome.split(/\s+as\s+/)[0].trim();
      if (limpo) exportados.add(limpo);
    }
  }
  const funcoes = (src.match(/^\s*(?:async\s+)?function\s+[A-Za-z0-9_$]+/gm) || []).length;
  const importa = [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map(m => m[1].replace(/\.js$/, ''));
  return { rel, linhas, exportados: [...exportados].sort(), funcoes, importa: [...new Set(importa)].sort() };
}

// Rotas da API: 'canal:acao': (p) => modulo.fn(...)
function rotas() {
  const src = ler('src/js/backend/servidor.js');
  const out = [];
  for (const m of src.matchAll(/^\s{2}'([a-z_]+:[A-Za-z]+)'\s*:\s*(\([^)]*\)|async\s*\([^)]*\))\s*=>\s*([^\n]+)/gm)) {
    const destino = m[3].trim().replace(/[,;]\s*$/, '');
    out.push({ canal: m[1], destino: destino.length > 62 ? destino.slice(0, 60) + '…' : destino });
  }
  return out;
}

function permissoes() {
  const src = ler('src/js/backend/servidor.js');
  const bloco = src.match(/const\s+PERMISSAO_ROTA\s*=\s*\{([\s\S]*?)\n\};/)
             || src.match(/PERM[A-Z_]*\s*=\s*\{([\s\S]*?)\n\};/);
  const mapa = {};
  if (bloco) {
    for (const m of bloco[1].matchAll(/'([a-z_]+:[A-Za-z]+)'\s*:\s*'([^']+)'/g)) mapa[m[1]] = m[2];
  }
  return mapa;
}

function tabelas() {
  const src = ler('src/schema.sql');
  const out = [];
  for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = m[2].split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('--') && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i.test(l))
      .map(l => l.split(/\s+/)[0].replace(/,$/, ''))
      .filter(Boolean);
    out.push({ nome: m[1], colunas: cols });
  }
  return out;
}

function menu() {
  const src = ler('src/js/app.js');
  const bloco = src.match(/const MENU = \[([\s\S]*?)\];/);
  if (!bloco) return [];
  return [...bloco[1].matchAll(/id:\s*'([^']+)',\s*rotulo:\s*'([^']+)'/g)]
    .map(m => ({ id: m[1], rotulo: m[2] }));
}

function versao() {
  try { return JSON.parse(ler('neutralino.config.json')).version; } catch { return '?'; }
}

// Pontos que escrevem estoque — crítico para a regra do total
function pontosEstoque() {
  const out = [];
  for (const rel of arquivosJs('src/js/backend/core')) {
    const src = ler(rel);
    const n = (src.match(/UPDATE variacoes SET estoque/g) || []).length;
    const aplica = (src.match(/estoques\.aplicar\(/g) || []).length;
    if (n || aplica) out.push({ arquivo: path.basename(rel), escreve_total: n, aplica_local: aplica });
  }
  return out;
}

// ── Render ──────────────────────────────────────────────────────────────────
const tab = (cab, linhas) =>
  [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map(l => `| ${l.join(' | ')} |`)].join('\n');

function gerar() {
  const v = versao();
  const hoje = new Date().toISOString().slice(0, 10);
  const core = arquivosJs('src/js/backend/core').map(analisa);
  const backend = arquivosJs('src/js/backend').map(analisa);
  const tela = arquivosJs('src/js').map(analisa);
  const rs = rotas();
  const perms = permissoes();
  const tbs = tabelas();
  const mn = menu();
  const pe = pontosEstoque();

  const porPrefixo = {};
  for (const r of rs) {
    const p = r.canal.split(':')[0];
    (porPrefixo[p] = porPrefixo[p] || []).push(r);
  }

  let md = `# GRAPHIFY — Salgueiro Gestão

> Mapa técnico gerado automaticamente por \`tools/graphify.js\`.
> **Não edite à mão.** Regere com \`node tools/graphify.js\` a cada alteração estrutural.

**Versão:** ${v} · **Gerado em:** ${hoje}
**Aplicação:** \`br.com.mllopes.salgueirogestao\` (Neutralino 6 + WebView2)
**Cliente:** Boutique do Salgueiro · **Autor:** ML Lopes Design

---

## 1. Identidade (imutável)

| Item | Valor |
|---|---|
| applicationId | \`br.com.mllopes.salgueirogestao\` |
| binaryName | \`salgueiro-gestao\` |
| Pasta de dados | \`%APPDATA%/SalgueiroGestao/dados\` |
| Banco | \`salgueiro.db\` (sql.js asm no WebView) |
| Porta da rede | 8750 (TCP) |

> Mudar qualquer um destes quebra a atualização automática e o banco dos clientes.

---

## 2. Arquitetura em uma passada

\`\`\`
index.html  (BOM UTF-8 + meta charset — sem isso o WebView2 quebra os acentos)
   │
   ├── js/app.js ─────────── shell, menu, permissões, roteamento de telas
   │     └── api(canal, payload)
   │            ├── Neutralino presente → js/backend/servidor.js  (local)
   │            └── senão              → fetch('/api')            (terminal em rede)
   │
   ├── js/<tela>.js ──────── uma por área do menu
   │
   └── js/backend/
         ├── servidor.js ─── despacha canal → core/*, aplica PERMISSAO_ROTA
         ├── db.js ────────── wrapper sql.js (API better-sqlite3) + migrações
         ├── ambiente.js ──── tudo que toca o SO (arquivos, impressão, versão)
         └── core/*.js ────── regra de negócio pura (testável com Node)
\`\`\`

---

## 3. Telas do menu

${tab(['id', 'Rótulo', 'Arquivo'], mn.map(m => [
    `\`${m.id}\``, m.rotulo,
    existe(`src/js/${m.id}.js`) ? `\`src/js/${m.id}.js\`` : '— (em app.js)'
  ]))}

---

## 4. Módulos de regra de negócio (\`src/js/backend/core\`)

${tab(['Arquivo', 'Linhas', 'Funções', 'Exporta'], core.map(c => [
    `\`${path.basename(c.rel)}\``, String(c.linhas), String(c.funcoes),
    c.exportados.length ? c.exportados.slice(0, 8).join(', ') + (c.exportados.length > 8 ? `, +${c.exportados.length - 8}` : '') : '—'
  ]))}

## 5. Backend (raiz)

${tab(['Arquivo', 'Linhas', 'Funções'], backend.map(c => [`\`${path.basename(c.rel)}\``, String(c.linhas), String(c.funcoes)]))}

## 6. Telas (\`src/js\`)

${tab(['Arquivo', 'Linhas', 'Exporta'], tela.map(c => [
    `\`${path.basename(c.rel)}\``, String(c.linhas), c.exportados.slice(0, 5).join(', ') || '—'
  ]))}

---

## 7. Rotas da API (${rs.length})

Toda comunicação tela ↔ backend passa por \`api('canal:acao', payload)\`.
A coluna **Permissão** vem de \`PERMISSAO_ROTA\` em \`servidor.js\` — sem entrada ali,
a rota exige apenas sessão válida.

${Object.keys(porPrefixo).sort().map(p => `
### \`${p}:*\`

${tab(['Canal', 'Permissão', 'Destino'], porPrefixo[p].map(r => [
    `\`${r.canal}\``, perms[r.canal] ? `\`${perms[r.canal]}\`` : '—', `\`${r.destino.replace(/\|/g, '\\|')}\``
  ]))}`).join('\n')}

---

## 8. Banco de dados (${tbs.length} tabelas)

${tab(['Tabela', 'Colunas'], tbs.map(t => [`\`${t.nome}\``, t.colunas.join(', ')]))}

> **Armadilha do schema:** \`criarBanco()\` divide o \`schema.sql\` pelo caractere
> ponto-e-vírgula. Um ponto-e-vírgula dentro de comentário parte o \`CREATE TABLE\`
> seguinte, que deixa de ser criado silenciosamente (o erro aparece como
> \`[schema] near "x": syntax error\`).

> **Armadilha do CHECK:** SQLite não altera \`CHECK\`. Para aceitar um valor novo
> em \`forma\`/\`tipo\` é preciso reconstruir a tabela (ver migrações em \`db.js\`).
> A guarda da migração deve testar o valor **entre aspas** — sem elas o teste casa
> com nomes de coluna parecidos e a reconstrução nunca roda.

---

## 9. Regra de ouro do estoque

\`\`\`
variacoes.estoque  =  TOTAL do Salgueiro  =  SUM(estoque_saldos.qtd)
\`\`\`

O total é a fonte de verdade de tudo que já existia. Os locais em \`estoque_saldos\`
apenas **repartem** esse total.

| Operação | Total | Local |
|---|---|---|
| Entrada (compra, cadastro) | +N | almoxarifado central +N |
| Venda | −N | local da loja do caixa −N |
| Devolução / cancelamento | +N | local da venda +N |
| Transferência | **igual** | origem −N, destino +N |

### Pontos que mexem em estoque

${tab(['Arquivo', 'Escreve o total', 'Aplica no local'], pe.map(p => [
    `\`${p.arquivo}\``, String(p.escreve_total), String(p.aplica_local)
  ]))}

> Ao acrescentar um ponto novo que mexa em estoque, ele precisa aparecer nas
> **duas** colunas, senão o total e a soma dos locais divergem.

---

## 10. Invariantes a verificar antes de entregar

1. \`node --check\` em todo arquivo tocado
2. Todo statement do \`schema.sql\` executa isolado (o app o divide por ponto-e-vírgula)
3. \`variacoes.estoque = SUM(estoque_saldos.qtd)\` para toda variação
4. Teste visual no sandbox com login real e 0 erro de JavaScript no console
5. SHA256 conferido entre a origem e o que foi copiado para \`Portable/\`
6. \`docs/MANUAL-DO-USUARIO.md\`, \`docs/GUIA-RAPIDO.md\` e este GRAPHIFY regerados
7. Bloco novo no topo de \`src/js/novidades.js\` (senão a versão fica sem o selo)
`;

  fs.writeFileSync(path.join(RAIZ, 'GRAPHIFY.md'), md, 'utf8');
  console.log(`GRAPHIFY.md gerado — v${v} · ${core.length} módulos core · ${rs.length} rotas · ${tbs.length} tabelas`);
}

gerar();
