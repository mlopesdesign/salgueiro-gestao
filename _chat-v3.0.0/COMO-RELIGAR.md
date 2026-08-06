# Chat interno + Avisos — código preservado da v3.0.0

> Este código **não está ativo**. Foi retirado do build na v3.0.1, junto com a
> correção da perda de dados, e guardado aqui inteiro para ser religado quando
> o Marcio decidir. **Nada foi perdido.**

## Por que foi retirado

A v3.0.0 apagou os dados de um cliente em produção. O chat não foi a causa
única, mas foi o **multiplicador**: `registrarPing` usava `.run()`, e todo
`.run()` do wrapper chama `_agendarSalvar()` (`db.js`), que reescreve o banco
INTEIRO no disco. Com o polling de presença (4–12 s), o banco de 1,8 MB passava
a ser regravado ~1.000×/hora. Como o `_escreverAtomico` da época **removia** o
arquivo antes de gravar o novo, cada uma dessas regravações era uma janela em
que o banco não existia no disco. Bastou o updater matar o processo numa delas.

**As três falhas já estão corrigidas na v3.0.1** (ver `CLAUDE.md`). O chat
guardado aqui **já contém a correção**: `registrarPing` usa `runVolatil()`.

## Estado no banco do cliente

As 6 tabelas **continuam existindo** no banco — a v3.0.1 não as remove
(`CREATE TABLE IF NOT EXISTS` não apaga nada, e o código novo simplesmente não
as consulta). **As conversas antigas estão preservadas.** Ao religar, o
histórico reaparece.

## Arquivos guardados

| Arquivo aqui | Destino ao religar |
|---|---|
| `core-mensagens.js` | `src/js/backend/core/mensagens.js` |
| `tela-mensagens.js` | `src/js/mensagens.js` |
| `schema-chat.sql` | colar no final de `src/schema.sql` |
| `estilos-chat.css` | colar no final de `src/css/app.css` |

**Está tudo aqui.** Nada mais depende do `H:` / Google Drive.

## Checklist para religar

1. Copiar os dois `.js` para os destinos da tabela acima.
2. Colar o conteúdo de `schema-chat.sql` no final de `src/schema.sql`.
3. `src/js/backend/servidor.js`:
   - `import * as mensagens from './core/mensagens.js';`
   - rotas: `mensagens:resumo`, `mensagens:contatos`, `mensagens:historico`,
     `mensagens:enviar`, `mensagens:marcarLido`, `mensagens:terminais`,
     `avisos:enviar`, `avisos:confirmar`, `avisos:listar`, `avisos:encerrar`
     — todas no formato `(p) => mensagens.X(db, sessao.usuario, p)`
   - `PERM_ROTA`: `mensagens.usar` para as de mensagens, `mensagens.avisar`
     para `avisos:enviar` e `avisos:encerrar`
   - migração `migr_mensagens_v300` (libera `mensagens.usar` para usuários que
     já tinham permissões personalizadas gravadas — sem ela, ficam sem o balão)
4. `src/js/backend/core/permissoes.js`: `mensagens.usar` e `mensagens.avisar`
   no `CATALOGO` e nos `DEFAULTS`.
5. `src/js/app.js`:
   - `import { viewMensagens, iniciarMensagens, pararMensagens, encerrarTelaMensagens } from './mensagens.js';`
   - item `mensagens` no `MENU` (💬 Mensagens) + `PERM_TELA` + `MODULO_TELA` + `SETOR_TELA`
   - `iniciarMensagens(usuario)` depois do `navegar('dashboard')`
   - `pararMensagens()` no logout
6. `src/css/app.css`: colar o conteúdo de `estilos-chat.css` no final.
   Depende das variáveis de tema já existentes e da animação `sobe`, que o
   `app.css` já tem.

## Regra que não pode ser esquecida

**Todo `.run()` do wrapper persiste o banco inteiro.** Qualquer dado de alta
frequência (presença, telemetria, contadores) **tem** que usar `runVolatil()`.
Antes de religar, conferir que nenhum caminho novo do chat grava a cada poucos
segundos com `.run()`.
