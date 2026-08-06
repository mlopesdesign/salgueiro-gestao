// Utilidades: senha (scrypt) e código de barras EAN-13
const crypto = require('crypto');

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 32).toString('hex');
  return `${sal}:${hash}`;
}

function verificarSenha(senha, senhaHash) {
  const [sal, hash] = String(senhaHash).split(':');
  if (!sal || !hash) return false;
  const teste = crypto.scryptSync(senha, sal, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(teste, 'hex'));
}

// Dígito verificador EAN-13 a partir dos 12 primeiros dígitos
function dvEan13(doze) {
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(doze[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (soma % 10)) % 10);
}

// Código interno no padrão EAN-13 iniciado em 2 (uso interno da loja)
function codigoInterno(sequencial) {
  const doze = ('2' + String(sequencial).padStart(11, '0')).slice(0, 12);
  return doze + dvEan13(doze);
}

function auditar(db, usuario, acao, detalhe) {
  db.prepare('INSERT INTO auditoria_log (usuario_id, acao, detalhe) VALUES (?,?,?)')
    .run(usuario ? usuario.id : null, acao, detalhe || null);
}

module.exports = { hashSenha, verificarSenha, dvEan13, codigoInterno, auditar };
