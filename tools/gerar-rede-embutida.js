// Gera src/js/backend/servidor-rede-embutido.js a partir de extensions/rede/servidor-rede.ps1.
// O app grava o .ps1 embutido no disco a cada abertura (ambiente.garantirExtensaoRede),
// e é assim que a atualização pelo resources.neu leva o servidor de rede novo.
// Uso: node tools/gerar-rede-embutida.js
import fs from 'node:fs';
const ps1 = fs.readFileSync('extensions/rede/servidor-rede.ps1', 'utf8');
const esc = ps1.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const hoje = new Date().toISOString().slice(0, 10);
fs.writeFileSync('src/js/backend/servidor-rede-embutido.js',
  `// AUTO-GERADO por tools/gerar-rede-embutida.js — não editar manualmente.\n` +
  `// Fonte: extensions/rede/servidor-rede.ps1. Gerado em: ${hoje}\n` +
  'export const SERVIDOR_REDE_PS1 = `' + esc + '`;\n');
console.log('servidor-rede-embutido.js gerado (' + ps1.length + ' caracteres)');
