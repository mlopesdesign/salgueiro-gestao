// Salgueiro Gestão V2 — Auto-updater via GitHub Releases
// Verifica se há nova versão disponível e baixa resources.neu.
// O download acontece no frontend (acesso ao NL_PATH e Neutralino.filesystem).
/* global NL_APPVERSION */

const GITHUB_OWNER = 'mlopesdesign';
const GITHUB_REPO  = 'salgueiro-gestao';
const API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

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
    const resp = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return { ok: false, erro: `GitHub HTTP ${resp.status}` };
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
