// Salgueiro Gestão V2 — Auto-updater via GitHub Releases
// Verifica se há nova versão disponível e baixa resources.neu.
// O download acontece no frontend (acesso ao NL_PATH e Neutralino.filesystem).
/* global NL_APPVERSION */

const GITHUB_OWNER = 'mlopesdesign';
// v3.37.0 — o repositório do CÓDIGO ficou privado (05/11/2026). As
// atualizações saem de um repositório PÚBLICO só com os arquivos da release
// (sem código). O antigo fica de reserva, caso volte a ser público.
const CANAIS = [
  `https://api.github.com/repos/${GITHUB_OWNER}/salgueiro-gestao-atualizacoes/releases/latest`,
  `https://api.github.com/repos/${GITHUB_OWNER}/salgueiro-gestao/releases/latest`,
];

// Compara duas versões semver "X.Y.Z" → 1 se a > b, -1 se a < b, 0 se igual
function _cmp(a, b) {
  const pa = String(a).replace(/^v/,'').split('.').map(Number);
  const pb = String(b).replace(/^v/,'').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i]||0) > (pb[i]||0)) return 1;
    if ((pa[i]||0) < (pb[i]||0)) return -1;
  }
  return 0;
}

// Consultado pela rota updater:verificar
export async function verificarAtualizacao(versaoAtual) {
  try {
    let resp = null, ultimoErro = '';
    for (const url of CANAIS) {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(10000) });
        if (r.ok) { resp = r; break; }
        ultimoErro = `GitHub HTTP ${r.status}`;
      } catch (e) { ultimoErro = e.message || 'Sem conexão.'; }
    }
    if (!resp) return { ok: false, erro: ultimoErro || 'Sem conexão.' };
    const release = await resp.json();

    const tag  = (release.tag_name || '').replace(/^v/, '');
    const asset = (release.assets || []).find(a => a.name === 'resources.neu');
    if (!tag)   return { ok: false, erro: 'Release sem tag de versão.' };
    if (!asset) return { ok: false, erro: 'Arquivo resources.neu não encontrado na release.' };

    const temAtualizacao = _cmp(tag, versaoAtual) > 0;
    return {
      ok: true,
      versaoAtual,
      versaoNova: tag,
      temAtualizacao,
      downloadUrl: asset.browser_download_url,
      tamanho: asset.size,
      notas: (release.body || '').slice(0, 800)
    };
  } catch (e) {
    return { ok: false, erro: e.message || 'Sem conexão ou repositório não encontrado.' };
  }
}
