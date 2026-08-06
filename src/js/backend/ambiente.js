// Ambiente de execução — implementação Neutralino (app desktop).
// Toda interação com o sistema operacional passa por aqui, para que a
// lógica de negócio permaneça pura e testável com Node no sandbox.
/* global Neutralino, NL_APPVERSION */
import { SERVIDOR_REDE_PS1 } from './servidor-rede-embutido.js';

let _dirDados = null;

async function _garantirDir(caminho) {
  // cria a árvore de pastas passo a passo (compatível com qualquer versão)
  const partes = caminho.replace(/\\/g, '/').split('/');
  let atual = '';
  for (const p of partes) {
    if (!p) { atual = '/'; continue; }
    atual = atual === '' ? p : (atual.endsWith('/') ? atual + p : atual + '/' + p);
    if (/^[A-Za-z]:$/.test(p)) continue; // raiz de unidade Windows
    try { await Neutralino.filesystem.createDirectory(atual); } catch { /* já existe */ }
  }
}

export async function dirDados() {
  if (_dirDados) return _dirDados;
  const base = await Neutralino.os.getPath('data'); // %APPDATA% no Windows
  _dirDados = `${base}/SalgueiroGestao/dados`;
  await _garantirDir(_dirDados);
  return _dirDados;
}

export async function arquivoBanco() {
  return `${await dirDados()}/salgueiro.db`;
}

// ── Banco de dados (bytes) ───────────────────────────────────────────────────
export let RECUPERADO_DE = null; // preenchido por lerBanco() quando houve resgate

export async function lerBanco() {
  const arq = await arquivoBanco();
  try { RECUPERADO_DE = await _recuperarSeFaltando(arq); } catch { RECUPERADO_DE = null; }
  try {
    const buf = await Neutralino.filesystem.readBinaryFile(arq);
    return new Uint8Array(buf);
  } catch { return null; } // primeira execução
}

export async function salvarBanco(bytes) {
  const arq = await arquivoBanco();
  await _escreverAtomico(arq, bytes);
}

// Gravação atômica SEM janela de inexistência.
//
// A versão anterior fazia: escreve .tmp → REMOVE o arquivo → move .tmp por cima.
// Entre o remove e o move o banco simplesmente não existia no disco. Se o
// processo morresse ali (updater reiniciando o app, queda de energia,
// fechamento forçado), o cliente perdia TUDO.
//
// Agora o arquivo bom só sai de cena depois que o novo já está no lugar:
//   1. escreve .tmp (conteúdo novo, completo)
//   2. renomeia o atual para .old   (nunca apaga — só encosta)
//   3. move .tmp → arquivo          (agora existe de novo)
//   4. remove .old                  (só aqui o antigo morre)
// Em qualquer instante existe pelo menos uma cópia íntegra: o arquivo, o .old
// ou o .tmp. `_recuperarSeFaltando()` roda no boot e reconstrói a partir delas.
async function _escreverAtomico(arquivo, bytes) {
  const tmp = arquivo + '.tmp';
  const old = arquivo + '.old';
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  await Neutralino.filesystem.writeBinaryFile(tmp, ab);

  // sobra de uma gravação anterior interrompida
  try { await Neutralino.filesystem.remove(old); } catch { /* não existe */ }

  let encostou = false;
  try {
    await Neutralino.filesystem.getStats(arquivo);
    await Neutralino.filesystem.move(arquivo, old);
    encostou = true;
  } catch { /* primeira gravação: não há arquivo atual */ }

  try {
    await Neutralino.filesystem.move(tmp, arquivo);
  } catch (e) {
    // não conseguiu publicar o novo: devolve o antigo para o lugar
    if (encostou) { try { await Neutralino.filesystem.move(old, arquivo); } catch {} }
    throw e;
  }

  if (encostou) { try { await Neutralino.filesystem.remove(old); } catch {} }
}

// Rede de segurança do boot: se o banco não estiver no lugar, reconstrói a
// partir dos restos de uma gravação interrompida. Chamada por lerBanco().
async function _recuperarSeFaltando(arquivo) {
  try { await Neutralino.filesystem.getStats(arquivo); return null; } catch { /* sumiu */ }

  // .old é o conteúdo anterior íntegro — preferência absoluta
  for (const sufixo of ['.old', '.tmp']) {
    try {
      const st = await Neutralino.filesystem.getStats(arquivo + sufixo);
      if (!st || !st.size) continue;
      await Neutralino.filesystem.move(arquivo + sufixo, arquivo);
      console.warn(`[recuperação] banco restaurado de ${sufixo} (${st.size} bytes)`);
      return sufixo;
    } catch { /* tenta o próximo */ }
  }
  return null;
}

export async function copiarBancoPara(destino, bytes) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await Neutralino.filesystem.writeBinaryFile(destino, ab);
}

export async function lerArquivoBinario(caminho) {
  const buf = await Neutralino.filesystem.readBinaryFile(caminho);
  return new Uint8Array(buf);
}

// ── Arquivos de texto na pasta de dados (licença, instalação, etc.) ─────────
export async function lerTextoDados(nome) {
  try { return await Neutralino.filesystem.readFile(`${await dirDados()}/${nome}`); }
  catch { return null; }
}

export async function escreverTextoDados(nome, texto) {
  await Neutralino.filesystem.writeFile(`${await dirDados()}/${nome}`, texto);
}

// ── Backups locais ───────────────────────────────────────────────────────────
export async function salvarBackupDiario(bytes) {
  try {
    const dir = `${await dirDados()}/backups`;
    await _garantirDir(dir);
    const hoje = new Date().toISOString().slice(0, 10);
    const destino = `${dir}/salgueiro-${hoje}.db`;
    try { await Neutralino.filesystem.getStats(destino); return; } catch { /* não existe ainda */ }
    if (bytes) await copiarBancoPara(destino, bytes);
    // mantém as últimas 30 cópias
    const itens = (await Neutralino.filesystem.readDirectory(dir))
      .filter(e => e.entry.endsWith('.db')).map(e => e.entry).sort();
    while (itens.length > 30) {
      const antigo = itens.shift();
      try { await Neutralino.filesystem.remove(`${dir}/${antigo}`); } catch {}
    }
  } catch (e) { console.error('[backup diário]', e); }
}

// Backup carimbado — usado antes de operações de risco (atualizar, restaurar).
// Diferente do diário, este SEMPRE grava: é o ponto de retorno da operação.
export async function salvarBackupCarimbado(bytes, rotulo) {
  if (!bytes || !bytes.length) throw new Error('Banco vazio: backup não faz sentido.');
  const dir = `${await dirDados()}/backups`;
  await _garantirDir(dir);
  const hora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = `${dir}/salgueiro-${rotulo}-${hora}.db`;
  await copiarBancoPara(destino, bytes);
  return destino;
}

export async function lerBackupLocal(nome) {
  if (!nome || /[\\/]/.test(nome)) throw new Error('Nome de backup inválido.');
  const dir = `${await dirDados()}/backups`;
  return lerArquivoBinario(`${dir}/${nome}`);
}

export async function listarBackupsLocais() {
  const dir = `${await dirDados()}/backups`;
  try {
    const itens = await Neutralino.filesystem.readDirectory(dir);
    const out = [];
    for (const e of itens) {
      if (!e.entry.endsWith('.db')) continue;
      let tamanho = 0, quando = null;
      try {
        const st = await Neutralino.filesystem.getStats(`${dir}/${e.entry}`);
        tamanho = st.size;
        quando = st.modifiedAt || st.createdAt || null;
      } catch {}
      out.push({ nome: e.entry, tamanho, quando });
    }
    return { backups: out.sort((a, b) => b.nome.localeCompare(a.nome)), pasta: dir.replace(/\//g, '\\') };
  } catch { return { backups: [], pasta: dir.replace(/\//g, '\\') }; }
}

// ── Diálogos nativos ─────────────────────────────────────────────────────────
export async function dialogoSalvar(titulo, nomePadrao) {
  const r = await Neutralino.os.showSaveDialog(titulo, {
    defaultPath: nomePadrao,
    filters: [{ name: 'Banco de dados', extensions: ['db'] }]
  });
  return r || null;
}

export async function dialogoAbrir(titulo) {
  const r = await Neutralino.os.showOpenDialog(titulo, {
    filters: [{ name: 'Banco de dados', extensions: ['db'] }]
  });
  return (r && r.length) ? r[0] : null;
}

// Garante que extensions/rede/servidor-rede.ps1 está atualizado no disco.
// Chamado no boot: quando resources.neu é atualizado pelo auto-updater,
// o PS1 embutido também é atualizado na próxima inicialização.
export async function garantirExtensaoRede() {
  try {
    const dir = `${NL_CWD}/extensions/rede`;
    await _garantirDir(dir);
    const dest = `${dir}/servidor-rede.ps1`;
    // Escrever o PS1 embutido em UTF-8
    const enc = new TextEncoder();
    const bytes = enc.encode(SERVIDOR_REDE_PS1);
    await Neutralino.filesystem.writeBinaryFile(dest, bytes.buffer);
  } catch (e) {
    // Não crítico: o PS1 pode já existir do instalador
    console.warn('garantirExtensaoRede:', e);
  }
}

// ── App ──────────────────────────────────────────────────────────────────────
export function versaoApp() {
  try { return NL_APPVERSION; } catch { return '3.5.1'; }
}

export async function reiniciarApp() {
  await Neutralino.app.restartProcess();
}

export async function sairApp() {
  await Neutralino.app.exit(0);
}

export async function carregarSchema() {
  const resp = await fetch('schema.sql');
  return resp.text();
}
