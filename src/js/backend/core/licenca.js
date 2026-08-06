// Licenciamento por blocos (módulos) com planos, senha de Dev e
// código de renovação mensal offline (arrendamento).
// Portado de legado/src/core/licenca.js. Diferença técnica: os arquivos
// JSON (instalacao/licenca/dev/setores) são carregados uma vez em memória
// no iniciar() e gravados de forma assíncrona a cada alteração — as
// verificações por rota continuam síncronas, como na V1.
/* global sha256 */

import { lerTextoDados, escreverTextoDados } from '../ambiente.js';

// ⚠️ TROQUE ESTES VALORES ANTES DE DISTRIBUIR — e guarde-os em segredo.
const CHAVE_MESTRA = 'MLLD-SALGUEIRO-2026-a8f3e1c94b7d2065';
const DEV_USUARIO = 'dev-mlopesdesign';
const DEV_SENHA_HASH_PADRAO = '1b3c1acc509edab8b0ca63516b44b700acc4fb0682fb2de14b4dab8b0226589f';

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

const LEITURA = new Set([
  'auth:login', 'auth:logout', 'auth:sessao', 'auth:listarUsuarios',
  'config:obter', 'permissoes:catalogo', 'dashboard:resumo',
  'licenca:status', 'licenca:renovar', 'dev:entrar', 'dev:aplicar', 'dev:trocarSenha', 'dev:setores', 'dev:resetarFabrica',
  'produtos:listar', 'produtos:obter', 'categorias:listar',
  'estoque:buscar', 'estoque:kardex', 'estoque:reposicao',
  'estoques:listar', 'estoques:conteudo', 'estoques:porVariacao',
  'estoques:transferencias', 'estoques:romaneio', 'estoques:conteudoXlsx',
  'clientes:listar', 'clientes:obter', 'clientes:listarCategorias', 'clientes:exportarDados', 'clientes:exportar',
  'crediario:abertas', 'crediario:aniversariantes', 'clientes:aniversariantes',
  'fornecedores:listar', 'compras:listar', 'compras:obter',
  'relatorios:vendas', 'relatorios:abc', 'relatorios:paradas', 'relatorios:receitaPorLoja', 'lojas:listar',
  'relatorios:evento', 'relatorios:eventoXlsx', 'relatorios:ranking', 'relatorios:rankingXlsx',
  'relatorios:eventos', 'relatorios:rankingPeriodo', 'relatorios:rankingPeriodoXlsx',
  'financeiro:listar', 'financeiro:fluxo', 'consignacao:resumo', 'consignacao:listar',
  'pdv:caixaAtual', 'pdv:resumoCaixa', 'pdv:listarVendas', 'pdv:obterVenda',
  'devolucoes:listar', 'devolucoes:itensVenda',
  'vales_troca:consultar', 'vales_troca:listar',
  'pontos:config', 'pontos:saldo', 'pontos:historico',
  'nuvem:status', 'backup:listarLocais', 'backup:manual', 'rede:status'
]);

// ── Armazenamento em memória (carregado no iniciar) ──────────────────────────
const ARQUIVOS = { instalacao: 'instalacao.json', licenca: 'licenca.json', dev: 'dev.json', setores: 'setores.json' };
const _cache = { instalacao: null, licenca: null, dev: null, setores: null };

export async function iniciar() {
  for (const [chave, nome] of Object.entries(ARQUIVOS)) {
    try {
      const txt = await lerTextoDados(nome);
      _cache[chave] = txt ? JSON.parse(txt) : null;
    } catch { _cache[chave] = null; }
  }
}

function _persistir(chave) {
  escreverTextoDados(ARQUIVOS[chave], JSON.stringify(_cache[chave], null, 2))
    .catch(e => console.error('[licenca] gravação falhou:', ARQUIVOS[chave], e));
}

function idInstalacao() {
  if (_cache.instalacao && _cache.instalacao.id) return _cache.instalacao.id;
  const b = new Uint8Array(4);
  globalThis.crypto.getRandomValues(b);
  const id = Array.from(b, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  _cache.instalacao = { id, criado_em: new Date().toISOString() };
  _persistir('instalacao');
  return id;
}

// ── Senha de Dev ──────────────────────────────────────────────────────────────
function hashSenha(s) { return sha256(String(s || '')); }
function devHashAtual() {
  if (_cache.dev && _cache.dev.senha_hash) return _cache.dev.senha_hash;
  return DEV_SENHA_HASH_PADRAO;
}
function senhaDevOk(senha) { return hashSenha(senha) === devHashAtual(); }

// ── Setores bloqueados ───────────────────────────────────────────────────────
function lerSetoresBloqueados() {
  const j = _cache.setores;
  if (j && Array.isArray(j.bloqueados)) return j.bloqueados.filter(s => SETORES[s]);
  return [];
}
function salvarSetoresBloqueados(lista) {
  const bloqueados = (Array.isArray(lista) ? lista : []).filter(s => SETORES[s]);
  _cache.setores = { bloqueados, atualizado_em: new Date().toISOString() };
  _persistir('setores');
  return bloqueados;
}
function setorBloqueado(setor) { return lerSetoresBloqueados().includes(setor); }

// ── Assinaturas e códigos ────────────────────────────────────────────────────
function hmac(texto) { return sha256.hmac(CHAVE_MESTRA, texto); }
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
function lerLicenca() {
  const l = _cache.licenca;
  if (l && l.assinatura === assinarLicenca(l)) return l;
  return null;
}
function salvarLicenca(l) {
  l.assinatura = assinarLicenca(l);
  _cache.licenca = l;
  _persistir('licenca');
  return l;
}

function estado() {
  const cliente_id = idInstalacao();
  const setores_bloqueados = lerSetoresBloqueados();
  const l = lerLicenca();
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

// ── Verificação por rota ─────────────────────────────────────────────────────
function verificar(canal) {
  const prefixo = canal.split(':')[0];
  for (const [setor, prefs] of Object.entries(SETOR_PREFIXOS)) {
    if (prefs.includes(prefixo) && setorBloqueado(setor)) {
      return `A área "${SETORES[setor]}" está desativada nesta instalação.`;
    }
  }
  const e = estado();
  const mod = MODULO_POR_PREFIXO[prefixo];
  if (mod && !e.modulos.includes(mod)) {
    return `O módulo "${MODULOS[mod]}" não está incluído no seu plano (${e.nome_plano}). Fale com o suporte para liberar.`;
  }
  if (e.vencida && !LEITURA.has(canal)) {
    return `Licença vencida em ${e.validade}. O sistema está em modo consulta — informe o código de renovação em Configurações → Licença.`;
  }
  return null;
}

function moduloAtivo(mod) { return estado().modulos.includes(mod); }

// ── Renovação pelo cliente (código offline) ─────────────────────────────────
function renovar(codigo) {
  const cod = String(codigo || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (cod.length !== 20) return { ok: false, erro: 'Código incompleto. Confira e digite novamente.' };
  const cliente_id = idInstalacao();
  const base = somarMes(mesAtual(), -2);
  for (const plano of Object.keys(PLANOS)) {
    for (let n = 0; n <= 20; n++) {
      const validade = somarMes(base, n);
      if (gerarCodigo(cliente_id, plano, validade).replace(/-/g, '') === cod) {
        const atual = lerLicenca() || {};
        const l = salvarLicenca({
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
function respostaDev() {
  return { ok: true, estado: estado(), catalogo: MODULOS, planos: PLANOS, nomes: NOME_PLANO,
           setores: SETORES, setores_bloqueados: lerSetoresBloqueados(),
           senha_padrao: devHashAtual() === DEV_SENHA_HASH_PADRAO };
}
function devEntrar(usuario, senha) {
  if (tentativasDev >= 8) return { ok: false, erro: 'Muitas tentativas. Reinicie o sistema.' };
  if (String(usuario || '').trim().toLowerCase() !== DEV_USUARIO) { tentativasDev++; return { ok: false, erro: 'Usuário de desenvolvedor incorreto.' }; }
  if (!senhaDevOk(senha)) { tentativasDev++; return { ok: false, erro: 'Senha de desenvolvedor incorreta.' }; }
  tentativasDev = 0;
  return respostaDev();
}
function devTrocarSenha(senhaAtual, novaSenha) {
  if (!senhaDevOk(senhaAtual)) return { ok: false, erro: 'Senha atual incorreta.' };
  const nova = String(novaSenha || '');
  if (nova.length < 6) return { ok: false, erro: 'A nova senha precisa ter ao menos 6 caracteres.' };
  _cache.dev = { senha_hash: hashSenha(nova), atualizado_em: new Date().toISOString() };
  _persistir('dev');
  return { ok: true };
}
function devSetores(senha, bloqueados) {
  if (!senhaDevOk(senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  const lista = salvarSetoresBloqueados(bloqueados);
  return { ok: true, setores_bloqueados: lista };
}
function devAplicar(p) {
  if (!senhaDevOk(p.senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  const plano = PLANOS[p.plano] ? p.plano : 'basico';
  const extras = Array.isArray(p.modulos_extras) ? p.modulos_extras.filter(m => MODULOS[m]) : [];
  const validade = /^\d{4}-\d{2}$/.test(p.validade || '') ? p.validade : mesAtual();
  salvarLicenca({
    cliente_id: idInstalacao(), plano, modulos_extras: extras, validade,
    atualizado_em: new Date().toISOString()
  });
  return { ok: true, estado: estado() };
}
function devRemover(senha) {
  if (!senhaDevOk(senha)) return { ok: false, erro: 'Senha de desenvolvedor incorreta.' };
  _cache.licenca = null;
  escreverTextoDados(ARQUIVOS.licenca, '').catch(() => {});
  return { ok: true, estado: estado() };
}

export {
  MODULOS, PLANOS, NOME_PLANO, SETORES, DEV_USUARIO,
  estado, verificar, moduloAtivo, renovar, setorBloqueado, lerSetoresBloqueados, senhaDevOk,
  devEntrar, devAplicar, devRemover, devTrocarSenha, devSetores,
  gerarCodigo, idInstalacao, mesAtual, somarMes
};
