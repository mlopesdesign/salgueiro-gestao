// Valida a tela de login de um Electron ja iniciado com --remote-debugging-port.
const port = process.env.CDP_PORT || '9224';

function cdpCall(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdpCall.nextId++;
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 5000);
    function onMessage(ev) {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      resolve(msg);
    }
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
cdpCall.nextId = 1;

(async () => {
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  if (!pages.length) throw new Error('Nenhuma pagina CDP encontrada.');
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  await cdpCall(ws, 'Runtime.enable');
  const expression = `({
    title: document.title,
    text: document.body.innerText,
    hasVersion: document.body.innerText.includes('Versão v1.0.4'),
    hasLogin: !!document.querySelector('#lg-entrar')
  })`;
  const result = await cdpCall(ws, 'Runtime.evaluate', { expression, returnByValue: true });
  ws.close();

  const value = result.result.result.value;
  console.log(JSON.stringify(value, null, 2));
  if (!value.hasVersion || !value.hasLogin) process.exit(2);
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
