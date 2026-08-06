// Licenciamento por blocos (módulos) com planos, senha de Dev e
// código de renovação mensal offline (arrendamento).
// Também controla os "setores" (áreas funcionais) que o desenvolvedor pode
// ligar/desligar por instalação (ex.: cliente não quer crediário, nuvem, etc.).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ⚠️ TROQUE ESTES VALORES ANTES DE DISTRIBUIR — e guarde-os em segredo.
const CHAVE_MESTRA = 'MLLD-SALGUEIRO-2026-a8f3e1c94b7d2065';
// Login do desenvolvedor
const DEV_USUARIO = 'dev-mlopesdesign';
// Senha PROVISÓRIA de Dev: "mldev@2026" (troque no painel dev no 1º acesso).
// Depois de trocada, o hash fica em dev.json (dataDir) e este valor é ignorado.
const DEV_SENHA_HASH_PADRAO = '6bbce9bfa5b4254e32fa765c24b2d67601c55d1ebfbe53371b8c8b6fb845d247';

// ── Catálogo de módulos (planos comerciais) ──────────────────────────────────
const MODULOS = {
  pdv:        'PDV, Caixa e Etiquetas',
  produtos:   'Produtos, Categorias e Estoque',
  compras:    'Compras e Fornecedores',
  clientes:   'Clientes e Crediário',
  financeiro: 'Financeiro',
  devolucoes: 'Devoluções e Vales-Troca',
  relatorios: 'Relatórios',
  pontos:     'Programa de Pontos',
  nuvem:      'Backup na Nuvem',
  rede:       'Acesso em Rede (multiterminal)'
};

const PLANOS = {
  basico:        ['pdv', 'produtos'],
  intermediario: ['pdv', 'produtos', 'compras', 'clientes', 'financeiro', 'devolucoes'],
  completo:      Object.keys(MODULOS)
};
const NOME_PLANO = { basico: 'Básico', intermediario: 'Intermediário', completo: 'Completo' };

// Qual módulo cada prefixo de rota exige (rotas fora da lista são sempre livres)
const MODULO_POR_PREFIXO = {
  'produtos': 'produtos', 'categorias': 'produtos', 'estoque': 'produtos',
  'pdv': 'pdv',
  'compras': 'compras', 'fornecedores': 'compras',
  'clientes': 'clientes', 'crediario': 'clientes',
  'financeiro': 'financeiro', 'consignacao': 'financeiro',
  'relatorios': 'relatorios',
  'devolucoes': 'devolucoes', 'vales_troca': 'devolucoes',
  'pontos': 'pontos',
  'nuvem': 'nuvem',
  'rede': 'rede'
};

// ── Setores (áreas funcionais que o Dev pode desligar por instalação) ─────────
// Independente do plano comercial: o Dev bloqueia e a área some do sistema.
const SETORES = {
  compras:     'Compras e Fornecedores',
  crediario:   'Crediário (venda a prazo)',
  financeiro:  'Financeiro (contas, fluxo)',
  relatorios:  'Relatórios',
  devolucoes:  'Devoluções',
  vales:       'Vales-Troca',
  pontos:      'Programa de Pontos',
  consignados: 'Consignados',
  nuvem:       'Backup na Nuvem',
  rede:        'Acesso em Rede'
};
// Prefixos de rota bloqueados quando o setor está desligado
const SETOR_PREFIXOS = {
  compras:     ['compras', 'fornecedores'],
  crediario:   ['crediario'],
  financeiro:  ['financeiro'],
  relatorios:  ['relatorios'],
  devolucoes:  ['devolucoes'],
  vales:       ['vales_troca'],
  pontos:      ['pontos'],
  consignados: ['consignacao'],
  nuvem:       ['nuvem'],
  rede:        ['rede']
};

// Canais permitidos mesmo com a licença VENCIDA (modo leitura)
const LEITURA = new Set([
  'auth:login', 'auth:logout', 'auth:sessao', 'auth:listarUsuarios',
  'config:obter', 'permissoes:catalogo', 'dashboard:resumo',
  'licenca:status', 'licenca:renovar', 'dev:entrar', 'dev:aplicar', 'dev:trocarSenha', 'dev:setores', 'dev:resetarFabrica',
  'produtos:listar', 'produtos:obter', 'categorias:listar',
  'estoque:buscar', 'estoque:kardex', 'estoque:reposicao',
  'clientes:listar', 'clientes:obter', 'clientes:listarCategorias', 'clientes:exportarDados', 'clientes:exportar',
  'crediario:abertas', 'crediario:aniversariantes',
  'fornecedores:listar', 'compras:listar', 'compras:obter',
  'relatorios:vendas', 'relatorios:abc', 'relatorios:paradas', 'relatorios:receitaPorLoja', 'lojas:listar',
  'financeiro:listar', 'financeiro:fluxo', 'consignacao:resumo', 'consignacao:listar',
  'pdv:caixaAtual', 'pdv:resumoCaixa', 'pdv:listarVendas', 'pdv:obterVenda',
  'devolucoes:listar', 'devolucoes:itensVenda',
  'vales_troca:consultar', 'vales_troca:listar',
  'pontos:config', 'pontos:saldo', 'pontos:historico',
  'nuvem:status', 'backup:listarLocais', 'backup:manual', 'rede:status'
]);

// ── Arquivos ─────────────────────────────────────────────────────────────────
const arqInstalacao = (dataDir) => path.join(dataDir, 'instalacao.json');
const arqLicenca = (dataDir) => path.join(dataDir, 'licenca.json');
const arqDev = (dataDir) => path.join(dataDir, 'dev.json');
const arqSetores = (dataDir) => path.join(dataDir, 'setores.json');

function idInstalacao(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(arqInstalacao(dataDir), 'utf8'));
    if (j.id) return j.id;
  } catch {}
  const id = crypto.randomBytes(4).toString('hex').toUpperCase();
  fs.writeFileSync(arqInstalacao(dataDir), JSON.stringify({ id, criado_em: new Date().toISOString() }, null, 2));
  return id;
}

// ── Senha de Dev (provisória por padrão; trocável em dev.json) ────────────────
function hashSenha(s) { return crypto.createHash('sha256').update(String(s || '')).digest('hex'); }
function devHashAtual(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(arqDev(dataDir), 'utf8'));
    if (j && j.senha_hash) return j.senha_hash;
  } catch {}
  return DEV_SENHA_HASH_PADRAO;
}
function senhaDevOk(dataDir, senha) { return hashSenha(senha) === devHashAtual(dataDir); }

// ── Setores bloqueados ───────────────────────────────────────────────────────
function lerSetoresBloqueados(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(arqSetores(dataDir), 'utf8'));
    if (Array.isArray(j.bloqueados)) return j.bloqueados.filter(s => SETORES[s]);
  } catch {}
  return [];
}
function salvarSetoresBloqueados(dataDir, lista) {
  const bloqueados = (Array.isArray(lista) ? lista : []).filter(s => SETORES[s]);
  fs.writeFileSync(arqSetores(dataDir), JSON.stringify({ bloqueados, atualizado_em: new Date().toISOString() }, null, 2));
  return bloqueados;
}
function setorBloqueado(dataDir, setor) { return lerSetoresBloqueados(dataDir).includes(setor); }

// ── Assinaturas e códigos ────────────────────────────────────────────────────
function hmac(texto) { return crypto.createHmac('sha256', CHAVE_MESTRA).update(texto).digest('hex'); }
function assinarLicenca(l) {
  return hmac(`LIC|${l.cliente_id}|${l.plano}|${(l.modulos_extras || []).slice().sort().join(',')}|${l.validade || ''}`);
}
function gerarCodigo(cliente_id, plano, validade) {
  const h = hmac(`COD|${cliente_id.toUpperCase()}|${plano}|${validade}`);
  const alf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 20; i++) s += alf[parseInt(h.slice(i * 2, i * 2 + 2), 16) % alf.length];
  return s.match(/.{4}/g).join('-');
}
function mesAtual() { return new Date().toISOString().slice(0, 7); }
function somarMes(aaaaMm, n) {
  const [a, m] = aaaaMm.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Leitura / estado ─────────────────────────────────────────────────────────
function lerLicenca(dataDir) {
  try {
    const l = JSON.parse(fs.readFileSync(arqLicenca(dataDir), 'utf8'));
    if (l && l.assinatura === assinarLicenca(l)) return l;
  } catch {}
  return null;
}
function salvarLicenca(dataDir, l) {
  l.assinatura = assinarLicenca(l);
  fs.writeFileSync(arqLicenca(dataDir), JSON.stringify(l, null, 2));
  return l;
}

function estado(dataDir) {
  const cliente_id = idInstalacao(dataDir);
  const setores_bloqueados = lerSetoresBloqueados(dataDir);
  const l = lerLicenca(dataDir);
  if (!l) {
    return { cliente_id, plano: 'completo', nome_plano: 'Completo (sem licença instalada)',
             modulos: Object.keys(MODULOS), validade: null, vencida: false, sem_licenca: true,
             setores_bloqueados };
  }
  const modulos = [...new Set([...(PLANOS[l.plano] || []), ...(l.modulos_extras || [])])];
  const vencida = !!l.validade && mesAtual() > l.validade;
  return { cliente_id, plano: l.plano, nome_plano: NOME_PLANO[l.plano] || l.plano,
           modulos, validade: l.validade, vencida, sem_licenca: false, setores_bloqueados };
}

// ── Verificação por rota (módulo do plano + setor desligado + vencimento) ─────
function verificar(dataDir, canal) {
  const prefixo = canal.split(':')[0];
  // 1) Setor desligado pelo Dev
  for (const [setor, prefs] of Object.entries(SETOR_PREFIXOS)) {
    if (prefs.includes(prefixo) && setorBloqueado(dataDir, setor)) {
      return `A área "${SETORES[setor]}" está desativada nesta instalação.`;
    }
  }
  const e = estado(dataDir);
  // 2) Módulo fora do plano contratado
  const mod = MODULO_POR_PREFIXO[prefixo];
  if (mod && !e.modulos.includes(mod)) {
    return `O módulo "${MODULOS[mod]}" não está incluído no seu plano (${e.nome_plano}). Fale com o suporte para liberar.`;
  }
  // 3) Licença vencida → modo consulta
  if (e.vencida && !LEITURA.has(canal)) {
    return `Licença vencida em ${e.validade}. O sistema está em modo consulta — informe o código de renovação em Configurações → Licença.`;
  }
  return null;
}

function moduloAtivo(dataDir, mod) { return estado(dataDir).modulos.includes(mod); }

// ── Renovação pelo cliente (código offline) ─────────────────────────────────
function renovar(dataDir, codigo) {
  const cod = String(codigo || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (cod.length !== 20) return { ok: false, erro: 'Código incompleto. Confira e digite novamente.' };
  const cliente_id = idInstalacao(dataDir);
  const base = somarMes(mesAtual(), -2);
  for (const plano of Object.keys(PLANOS)) {
    for (let n = 0; n <= 20; n++) {
      const validade = somarMes(base, n);
      if (gerarCodigo(cliente_id, plano, validade).replace(/-/g, '') === cod) {
        const atual = lerLicenca(dataDir) || {};
        const l = salvarLicenca(dataDir, {
          cliente_id, plano, validade,
          modulos_extras: atual.modulos_extras || [],
          atualizado_em: new Date().toISOString()
        });
        return { ok: true, plano: NOME_PLANO[plano], validade: l.validade };
      }
    }
  }
  return { ok: false, erro: 'Código inválido para esta instalação.' };
}

// ── Área do desenvolvedor ────────────────────────────────────────────────────
let tentativasDev = 0;
function respostaDev(dataDir) {
  return { ok: true, estado: estado(dataDir), catalogo: MODULOS, planos: PLANOS, nomes: NOME_PLANO,
           setores: SETORES, setores_bloqueados: lerSetoresBloqueados(dataDir),
           senha_padrao: devHashAtual(dataDir) === DEV_SENHA_HASH_PADRAO };
}
function devEntrar(dataDir, usuario, senha) {
  if (tentativasDev >= 8) return { ok: false, erro: 'Muitas tentativas. Reinicie o sistema.' };
  if (String(usuario || '').trim().toLowerCase() !== DEV_USUARIO) { tentativasDev++; return { ok: false, erro: 'Usuário de desenvolvedor incorreto.' }; }
  if (!senhaDevOk(dataDir, senha)) { tentativasDev++; return { ok: false, erro: 'Senha de desenvolvedor incorreta.' }; }
  tentativasDev = 0;
  return respostaDev(dataDir);
}
function devTrocarSenha(dataDir, senhaAtual, novaSenha) {
  if (!senhaDevOk(dataDir, senhaAtual)) return { ok: false, erro: 'Senha atual incorreta.' };
  const nova = String(novaSenha || '');
  if (nova.length < 6) return { ok: false, erro: 'A nova senha precisa ter ao menos 6 caracteres.' };
  fs.writeFileSync(arqDev(dataDir), JSON.stringify({ senha_hash: hashSenha(nova), atualizado_em: new Date().toISOString() }, null, 2));
  return { ok: true };
}
function devSetores(dataDir, senha, bloqueados) {
  if (!senhaDevOk(dataDir, senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  const lista = salvarSetoresBloqueados(dataDir, bloqueados);
  return { ok: true, setores_bloqueados: lista };
}
function devAplicar(dataDir, p) {
  if (!senhaDevOk(dataDir, p.senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  const plano = PLANOS[p.plano] ? p.plano : 'basico';
  const extras = Array.isArray(p.modulos_extras) ? p.modulos_extras.filter(m => MODULOS[m]) : [];
  const validade = /^\d{4}-\d{2}$/.test(p.validade || '') ? p.validade : mesAtual();
  salvarLicenca(dataDir, {
    cliente_id: idInstalacao(dataDir), plano, modulos_extras: extras, validade,
    atualizado_em: new Date().toISOString()
  });
  return { ok: true, estado: estado(dataDir) };
}
function devRemover(dataDir, senha) {
  if (!senhaDevOk(dataDir, senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  try { fs.unlinkSync(arqLicenca(dataDir)); } catch {}
  return { ok: true, estado: estado(dataDir) };
}

module.exports = {
  MODULOS, PLANOS, NOME_PLANO, SETORES, DEV_USUARIO,
  estado, verificar, moduloAtivo, renovar, setorBloqueado, lerSetoresBloqueados, senhaDevOk,
  devEntrar, devAplicar, devRemover, devTrocarSenha, devSetores,
  gerarCodigo, idInstalacao, mesAtual, somarMes
};
