// Utilidades: senha (scrypt) e código de barras EAN-13
// Portado de legado/src/core/util.js.
// scrypt: mesmos parâmetros do crypto.scryptSync do Node (N=16384, r=8, p=1,
// chave de 32 bytes, sal string hex tratada como bytes utf-8) — os hashes
// gravados pela V1 continuam validando aqui, byte a byte.
/* global scrypt */

const N = 16384, R = 8, P = 1, DKLEN = 32;

const _enc = new TextEncoder();

function _hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function _hexParaBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function _aleatorioHex(nBytes) {
  const b = new Uint8Array(nBytes);
  globalThis.crypto.getRandomValues(b);
  return _hex(b);
}

async function _scryptHex(senha, salStr) {
  const chave = await scrypt.scrypt(_enc.encode(String(senha)), _enc.encode(String(salStr)), N, R, P, DKLEN);
  return _hex(chave);
}

export async function hashSenha(senha) {
  const sal = _aleatorioHex(16);
  const hash = await _scryptHex(senha, sal);
  return `${sal}:${hash}`;
}

export async function verificarSenha(senha, senhaHash) {
  const [sal, hash] = String(senhaHash).split(':');
  if (!sal || !hash) return false;
  const teste = await _scryptHex(senha, sal);
  // comparação em tempo constante
  const a = _hexParaBytes(hash), b = _hexParaBytes(teste);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

// Dígito verificador EAN-13 a partir dos 12 primeiros dígitos
export function dvEan13(doze) {
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(doze[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (soma % 10)) % 10);
}

// Código interno no padrão EAN-13 iniciado em 2 (uso interno da loja)
export function codigoInterno(sequencial) {
  const doze = ('2' + String(sequencial).padStart(11, '0')).slice(0, 12);
  return doze + dvEan13(doze);
}

export function auditar(db, usuario, acao, detalhe) {
  db.prepare('INSERT INTO auditoria_log (usuario_id, acao, detalhe) VALUES (?,?,?)')
    .run(usuario ? usuario.id : null, acao, detalhe || null);
}
