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

// ── Fotos em disco (v3.25.22) ────────────────────────────────────────────────
// As fotos de produto/variação passaram a ficar como ARQUIVOS em dados/fotos,
// e o banco guarda só o nome do arquivo. Antes iam como base64 dentro do banco,
// o que inflava o .db a dezenas de MB — e o export() de cada gravação estourava
// a memória do SQLite em WebAssembly (Aborted OOM) no Windows.
//
// A pasta fica DENTRO de dados/ (perfil Roaming), o mesmo cofre do banco e dos
// backups: nenhuma atualização ou desinstalação toca ali.
let _dirFotos = null;
export async function dirFotos() {
  if (_dirFotos) return _dirFotos;
  _dirFotos = `${await dirDados()}/fotos`;
  await _garantirDir(_dirFotos);
  return _dirFotos;
}

function _tokenFoto() {
  try { if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, ''); } catch {}
  return 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}
function _extDataUri(dataUri) {
  const m = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(dataUri || '');
  const t = (m && m[1] || 'jpeg').toLowerCase();
  return t === 'jpeg' ? 'jpg' : (t.replace(/[^a-z0-9]/g, '') || 'jpg');
}
function _mimeDeNome(nome) {
  const ext = String(nome).split('.').pop().toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp'
       : ext === 'gif' ? 'image/gif' : 'image/jpeg';
}

// Grava um data URI como arquivo e devolve o NOME do arquivo (para o banco).
// Devolve null se não for um data URI de imagem (nesse caso o chamador mantém
// o valor que já tinha — pode já ser um nome de arquivo).
export async function salvarFotoArquivo(dataUri) {
  const s = dataUri == null ? '' : String(dataUri);
  if (!s.startsWith('data:image/')) return null;
  const b64 = s.slice(s.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const nome = `${_tokenFoto()}.${_extDataUri(s)}`;
  const dir = await dirFotos();
  await Neutralino.filesystem.writeBinaryFile(`${dir}/${nome}`, bytes.buffer);
  return nome;
}

// Resolve o valor guardado no banco para algo que o <img src> aceita.
// Aceita os DOIS formatos, para nunca quebrar durante/antes da migração:
//   - já é data URI (legado, ainda inline)  → devolve como está
//   - é nome de arquivo                      → lê o arquivo e devolve data URI
export async function lerFotoArquivo(valor) {
  const s = valor == null ? '' : String(valor);
  if (!s) return null;
  if (s.startsWith('data:image/')) return s;
  try {
    const dir = await dirFotos();
    const buf = await Neutralino.filesystem.readBinaryFile(`${dir}/${s}`);
    const bytes = new Uint8Array(buf);
    let bin = ''; const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    return `data:${_mimeDeNome(s)};base64,${btoa(bin)}`;
  } catch { return null; } // arquivo sumiu: trata como sem foto
}

// ── Banco de dados (bytes) ───────────────────────────────────────────────────
export let RECUPERADO_DE = null; // preenchido por lerBanco() quando houve resgate

// v3.33.1 — "não existe" e "não consegui ler" são coisas DIFERENTES.
// Antes, qualquer falha de leitura devolvia null = "primeira execução": o
// sistema criava um banco VAZIO e gravava por cima do arquivo bom. Agora, se o
// arquivo existe e tem tamanho mas a leitura falhou (arquivo preso por outro
// processo, antivírus, sincronização), tenta de novo e, se não der, PARA —
// nunca abre vazio por cima de dados.
export async function lerBanco() {
  const arq = await arquivoBanco();
  try { RECUPERADO_DE = await _recuperarSeFaltando(arq); } catch { RECUPERADO_DE = null; }
  let tamanho = 0;
  try { const st = await Neutralino.filesystem.getStats(arq); tamanho = (st && st.size) || 0; }
  catch { return null; }                       // não existe: primeira execução de verdade
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    try {
      const buf = new Uint8Array(await Neutralino.filesystem.readBinaryFile(arq));
      if (buf.length || !tamanho) return buf;
      ultimoErro = new Error('leitura voltou vazia');
    } catch (e) { ultimoErro = e; }
    await new Promise(r => setTimeout(r, 500 * tentativa));
  }
  const err = new Error(`BANCO_ILEGIVEL: ${tamanho} bytes no disco e a leitura falhou (${ultimoErro && (ultimoErro.message || ultimoErro.code) || ultimoErro})`);
  err.code = 'BANCO_ILEGIVEL';
  throw err;
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

  // v3.33.2 — confere o que foi escrito ANTES de publicar: um .tmp que não
  // começa com o cabeçalho do SQLite nunca vai para o lugar do banco.
  await _conferirCabecalho(tmp, bytes.byteLength);

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

  // v3.33.2 — o banco ANTERIOR não é mais apagado: vira salgueiro.db.anterior.
  // Em 27/10 o salgueiro.db da loja amanheceu 100% ZERADO (2,6 MB de zeros —
  // o Windows desligou de repente logo depois de uma gravação: o tamanho foi
  // registrado, o conteúdo não). Com o .anterior guardado, a perda máxima
  // nesse caso passa a ser a última gravação, não dias.
  if (encostou) {
    const ant = arquivo + '.anterior';
    try { await Neutralino.filesystem.remove(ant); } catch { /* não existe */ }
    try { await Neutralino.filesystem.move(old, ant); }
    catch { try { await Neutralino.filesystem.remove(old); } catch {} }
  }
}

const _CAB_SQLITE = 'SQLite format 3';
export function temCabecalhoSqlite(bytes) {
  if (!bytes || bytes.length < 16) return false;
  for (let i = 0; i < 15; i++) if (bytes[i] !== _CAB_SQLITE.charCodeAt(i)) return false;
  return bytes[15] === 0;
}
// Arquivo inteiro de zeros = o retrato do desligamento abrupto (v3.33.2).
export function estaZerado(bytes) {
  if (!bytes || !bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 4096) if (bytes[i] !== 0 || bytes[i + 100] !== 0) return false;
  return bytes.every(x => x === 0);
}
async function _conferirCabecalho(caminho, esperado) {
  let ini;
  try { ini = new Uint8Array(await Neutralino.filesystem.readBinaryFile(caminho, { pos: 0, size: 16 })); }
  catch { ini = new Uint8Array(await Neutralino.filesystem.readBinaryFile(caminho)).subarray(0, 16); }
  let tam = esperado;
  try { const st = await Neutralino.filesystem.getStats(caminho); tam = st.size; } catch { /* */ }
  if (!temCabecalhoSqlite(ini) || tam !== esperado) {
    throw new Error(`gravação conferida e recusada: ${caminho} (${tam} de ${esperado} bytes, cabeçalho ${temCabecalhoSqlite(ini) ? 'ok' : 'inválido'})`);
  }
}

// Cópia de antes da última gravação (salgueiro.db.anterior), se existir.
export async function lerBancoAnterior() {
  try { return new Uint8Array(await Neutralino.filesystem.readBinaryFile((await arquivoBanco()) + '.anterior')); }
  catch { return null; }
}

// CÓPIAS AUTOMÁTICAS com o sistema aberto (v3.34.0; antes, de hora em hora
// na v3.33.2). Nascem por GATILHO, sempre que houve alteração desde a última:
//   30min        — a cada 30 minutos
//   ocioso       — 5 minutos depois da última gravação (pega o fim do
//                  movimento: PDV esquecido aberto e computador ligado)
//   abriu-caixa / fechou-caixa / abertura / ao-fechar
// Nome: salgueiro-auto-AAAA-MM-DDTHH-MM-SS-<motivo>.db (hora UTC).
// Ficam as últimas 96 (≈ 2 dias de movimento). Cada uma é conferida depois de
// gravada (cabeçalho + tamanho) e nunca é regravada: o Windows tem tempo de
// colocar no disco, o que não acontece com o banco em uso, reescrito a toda hora.
export const RX_COPIA_AUTO = /^salgueiro-auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.db$/;
export async function salvarCopiaAutomatica(bytes, motivo) {
  if (!bytes || !bytes.length) return null;
  const dir = `${await dirDados()}/backups`;
  await _garantirDir(dir);
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const m = String(motivo || 'auto').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'auto';
  const destino = `${dir}/salgueiro-auto-${ts}-${m}.db`;
  await copiarBancoPara(destino, bytes);
  await _conferirCabecalho(destino, bytes.length);
  try {
    const itens = (await Neutralino.filesystem.readDirectory(dir))
      .filter(e => e.entry.endsWith('.db')).map(e => e.entry);
    for (const antigo of backupsParaApagar(itens)) {
      try { await Neutralino.filesystem.remove(`${dir}/${antigo}`); } catch {}
    }
  } catch { /* limpeza fica para a próxima */ }
  return destino;
}
// compatibilidade (3.33.2)
export async function salvarBackupHora(bytes) { return salvarCopiaAutomatica(bytes, 'hora'); }

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
// v3.33.1 — DATA de um backup, tirada do nome (é o que o sistema escreveu):
//   salgueiro-2026-10-27.db                                  (diário)
//   salgueiro-pre-atualizacao-v3.33.0-2026-10-22T14-05-10.db (carimbado)
// Antes a lista era ordenada pelo NOME, e "salgueiro-pre-atualizacao-v3.9.0"
// vinha antes de tudo: letra > número e "9" > "33". A recuperação automática
// escolhia a cópia de AGOSTO como "a mais nova", e a limpeza das 30 cópias
// apagava justamente os diários e as cópias recentes. Agora é pela data.
export function dataDoBackup(nome, quando) {
  const m = String(nome || '').match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})-(\d{2})-(\d{2}))?/);
  if (m) {
    // carimbado = hora UTC (toISOString); diário = só o dia (conta como meio-dia)
    const ms = m[4] != null
      ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
      : Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
    if (Number.isFinite(ms)) return ms;
  }
  const q = Number(quando) || 0;
  return q > 1e12 ? q : q * 1000;   // getStats pode vir em s ou ms
}
export function ordenarBackups(lista) {
  return [...lista].sort((a, b) => (dataDoBackup(b.nome, b.quando) - dataDoBackup(a.nome, a.quando))
    || String(b.nome).localeCompare(String(a.nome)));
}
// Quais apagar para manter as últimas 30 diárias e as últimas 20 das outras
// (antes de atualizar, de restaurar...). Sempre as MAIS ANTIGAS de cada grupo.
export function backupsParaApagar(nomes) {
  const diario = /^salgueiro-\d{4}-\d{2}-\d{2}\.db$/;
  const porHora = /^salgueiro-(hora|auto)-/;
  const velhosPrimeiro = (l) => [...l].sort((a, b) => dataDoBackup(a) - dataDoBackup(b) || a.localeCompare(b));
  const d = velhosPrimeiro(nomes.filter(n => diario.test(n)));
  const h = velhosPrimeiro(nomes.filter(n => porHora.test(n)));
  const o = velhosPrimeiro(nomes.filter(n => !diario.test(n) && !porHora.test(n)));
  return [...d.slice(0, Math.max(0, d.length - 30)),
          ...h.slice(0, Math.max(0, h.length - 96)),
          ...o.slice(0, Math.max(0, o.length - 20))];
}

export async function salvarBackupDiario(bytes) {
  try {
    const dir = `${await dirDados()}/backups`;
    await _garantirDir(dir);
    const hoje = new Date().toISOString().slice(0, 10);
    const destino = `${dir}/salgueiro-${hoje}.db`;
    try { await Neutralino.filesystem.getStats(destino); return; } catch { /* não existe ainda */ }
    if (bytes) await copiarBancoPara(destino, bytes);
    // mantém as últimas 30 diárias e as últimas 20 das outras — pela DATA (v3.33.1)
    const itens = (await Neutralino.filesystem.readDirectory(dir))
      .filter(e => e.entry.endsWith('.db')).map(e => e.entry);
    for (const antigo of backupsParaApagar(itens)) {
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

// Cópias de segurança que ficam na RAIZ da pasta de dados (não em backups/):
// o banco guardado pela recuperação automática, o estado antes de cada
// restauração e o de antes de zerar. Aparecem na lista de Backup (v3.33.1)
// para que o banco "com problema" possa ser examinado e, se tiver os dados,
// restaurado pela tela.
export const RX_COPIA_RAIZ = /^(banco-com-problema|pre-restauracao|backup-antes-reset)-.+\.db$/;

export async function lerBackupLocal(nome) {
  if (!nome || /[\\/]/.test(nome)) throw new Error('Nome de backup inválido.');
  const dir = RX_COPIA_RAIZ.test(nome) ? await dirDados() : `${await dirDados()}/backups`;
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
      out.push({ nome: e.entry, tamanho, quando, data: dataDoBackup(e.entry, quando) });
    }
    try {
      const raiz = await dirDados();
      for (const e of await Neutralino.filesystem.readDirectory(raiz)) {
        if (!RX_COPIA_RAIZ.test(e.entry)) continue;
        let tamanho = 0, quando = null;
        try { const st = await Neutralino.filesystem.getStats(`${raiz}/${e.entry}`); tamanho = st.size; quando = st.modifiedAt || st.createdAt || null; } catch {}
        out.push({ nome: e.entry, tamanho, quando, data: dataDoBackup(e.entry, quando), raiz: true });
      }
    } catch { /* sem cópias na raiz */ }
    // mais NOVO primeiro, pela data (v3.33.1 — antes era pelo nome)
    return { backups: ordenarBackups(out), pasta: dir.replace(/\//g, '\\') };
  } catch { return { backups: [], pasta: dir.replace(/\//g, '\\') }; }
}

// Nomes dos arquivos de foto que existem em dados/fotos (v3.25.32).
// Usado pelo reparo automático de vínculo foto↔produto no boot.
export async function listarArquivosFotos() {
  try {
    const dir = await dirFotos();
    const itens = await Neutralino.filesystem.readDirectory(dir);
    return itens
      .filter(e => e.type !== 'DIRECTORY' && /\.(jpe?g|png|webp|gif)$/i.test(e.entry))
      .map(e => e.entry);
  } catch { return []; }
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
//
// v3.31.0: devolve { mudou } — o Neutralino já iniciou a extensão ANTES deste
// código rodar, então o arquivo novo só vale depois de reabrir o sistema.
// Quem chama decide se reabre (só quando o acesso em rede está ligado).
export async function garantirExtensaoRede() {
  try {
    const dir = `${NL_CWD}/extensions/rede`;
    await _garantirDir(dir);
    const dest = `${dir}/servidor-rede.ps1`;
    let atual = null;
    try { atual = await Neutralino.filesystem.readFile(dest); } catch { /* não existe */ }
    if (atual === SERVIDOR_REDE_PS1) return { mudou: false };
    // Escrever o PS1 embutido em UTF-8
    const enc = new TextEncoder();
    const bytes = enc.encode(SERVIDOR_REDE_PS1);
    await Neutralino.filesystem.writeBinaryFile(dest, bytes.buffer);
    // confere a gravação — sem isso um disco protegido faria o sistema reabrir à toa
    let gravado = null;
    try { gravado = await Neutralino.filesystem.readFile(dest); } catch { /* */ }
    return { mudou: gravado === SERVIDOR_REDE_PS1 };
  } catch (e) {
    // Não crítico: o PS1 pode já existir do instalador
    console.warn('garantirExtensaoRede:', e);
    return { mudou: false };
  }
}

// ── LOG DE DIAGNÓSTICO (v3.31.0) ────────────────────────────────────────────
// Um arquivo por dia em %APPDATA%/SalgueiroGestao/logs/app-AAAA-MM-DD.log, ao
// lado do rede-AAAA-MM-DD.log que a extensão grava. Mesmo formato de linha:
//   HH:MM:SS.mmm TIPO          mensagem
// A gravação é enfileirada e nunca trava quem chama — se falhar, segue a vida.
let _dirLogs = null;
const _filaLog = [];
let _gravandoLog = false;
export async function dirLogs() {
  if (_dirLogs) return _dirLogs;
  const base = await Neutralino.os.getPath('data');
  _dirLogs = `${base}/SalgueiroGestao/logs`;
  await _garantirDir(_dirLogs);
  return _dirLogs;
}
const _2 = (n) => String(n).padStart(2, '0');
export function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${_2(d.getMonth() + 1)}-${_2(d.getDate())}`;
}
export function registrarLog(tipo, msg) {
  const d = new Date();
  const hora = `${_2(d.getHours())}:${_2(d.getMinutes())}:${_2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  _filaLog.push({ dia: dataLocal(d), linha: `${hora} ${String(tipo).padEnd(13)} ${String(msg).replace(/[\r\n]+/g, ' ')}\r\n` });
  return _esvaziarLog();
}
async function _esvaziarLog() {
  if (_gravandoLog) return;
  _gravandoLog = true;
  try {
    const dir = await dirLogs();
    while (_filaLog.length) {
      const dia = _filaLog[0].dia;
      let bloco = '';
      while (_filaLog.length && _filaLog[0].dia === dia) bloco += _filaLog.shift().linha;
      try { await Neutralino.filesystem.appendFile(`${dir}/app-${dia}.log`, bloco); } catch { /* segue */ }
    }
  } catch { /* sem pasta de log: não é motivo para parar o sistema */ }
  finally { _gravandoLog = false; }
}
// Lê os logs de um dia (rede + aplicativo) e lista os dias que existem.
export async function lerLogs(dia) {
  const dir = await dirLogs();
  let dias = [];
  try {
    const itens = await Neutralino.filesystem.readDirectory(dir);
    const set = new Set();
    for (const it of itens) {
      const m = /^(rede|app)-(\d{4}-\d{2}-\d{2})\.log$/.exec(it.entry || '');
      if (m) set.add(m[2]);
    }
    dias = [...set].sort().reverse();
  } catch { /* pasta vazia */ }
  const ler = async (nome) => { try { return await Neutralino.filesystem.readFile(`${dir}/${nome}`); } catch { return ''; } };
  const d = dia || dias[0] || dataLocal();
  return { dir, dias, dia: d, rede: await ler(`rede-${d}.log`), app: await ler(`app-${d}.log`) };
}

// ── App ──────────────────────────────────────────────────────────────────────
export function versaoApp() {
  try { return NL_APPVERSION; } catch { return '3.34.2'; }
}

// v3.34.2 — o reinício TEM de encerrar este processo. Na loja (27/10) a
// restauração gravou o banco certo, mas o reinício não aconteceu: o processo
// velho continuou aberto com os dados antigos na memória e, na gravação
// seguinte, escreveu por cima do banco restaurado ("restaurei e voltou").
// Agora: tenta reabrir; se em 4 s este processo ainda estiver vivo, encerra à
// força. Se nem a reabertura funcionou, avisa para abrir de novo.
export async function reiniciarApp() {
  let falhou = null;
  try { await Neutralino.app.restartProcess(); } catch (e) { falhou = e; }
  if (falhou) {
    try { await registrarLog('APP', `reabertura automática falhou: ${falhou && (falhou.message || falhou.code) || falhou}`); } catch { /* */ }
    try { alert('O sistema vai fechar agora. Abra o Salgueiro Gestão de novo pelo atalho.'); } catch { /* */ }
  }
  setTimeout(async () => {
    try { await registrarLog('APP', 'processo ainda aberto depois do reinício — encerrando à força'); } catch { /* */ }
    try { await Neutralino.app.exit(0); } catch { /* */ }
    setTimeout(() => { try { Neutralino.app.killProcess(); } catch { /* */ } }, 1500);
  }, falhou ? 300 : 4000);
}

// GERAÇÃO DO PROCESSO (v3.34.2). Cada abertura do sistema grava um código novo
// em dados/geracao.txt. Antes de gravar o banco, o processo confere se o código
// ainda é o dele: se não for, existe um processo MAIS NOVO (ou o banco foi
// restaurado) e este é um processo antigo esquecido aberto — ele não grava e
// se fecha. Impede que dois programas abertos escrevam um por cima do outro.
export async function gravarGeracao(codigo) {
  await Neutralino.filesystem.writeFile(`${await dirDados()}/geracao.txt`, String(codigo));
}
export async function lerGeracao() {
  try { return String(await Neutralino.filesystem.readFile(`${await dirDados()}/geracao.txt`)).trim(); }
  catch { return null; }
}

export async function sairApp() {
  await Neutralino.app.exit(0);
}

export async function carregarSchema() {
  const resp = await fetch('schema.sql');
  return resp.text();
}
