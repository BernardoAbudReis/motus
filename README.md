# MOTUS: hábitos e academia (PWA)

Sistema web instalável (PWA) para hábitos pessoais e treinos de academia. Funciona no navegador do computador, no Android (Chrome) e no iPhone (Safari), sem lojas de aplicativos.

## Identidade visual

- Fundo `#090C15`, superfícies `#111722`, bordas `#252D39`, texto `#F6F5F6`, texto secundário `#A3A5AA`.
- O verde menta `#53E79F` é a única cor de destaque. O verde escuro `#123B2B` serve de fundo de destaque.
- Os tokens ficam em `web/src/estilos.css`. O símbolo está em vetor em `web/public/logo.svg`, e o logo original em `docs/marca/`.
- Cores dos cards de hábito: tons sóbrios escolhidos pelo usuário (`CORES_HABITO` em `web/src/habitos/dados.ts`), sem roxo, azul ou dourado.

## Estrutura

- `web/`: front-end em React + TypeScript + Vite, com `vite-plugin-pwa` (manifest, service worker e aviso de nova versão).
- `api/`: back-end em Node + Express + PostgreSQL. Cuida do login e da sincronização. Em produção, também entrega o front (`web/dist`).
- `docker-compose.yml`: PostgreSQL de desenvolvimento, na porta 15433.

## Como os dados funcionam (offline primeiro)

1. Tudo é gravado primeiro no **IndexedDB** do aparelho (`web/src/db.ts`). O app funciona sem internet e sem conta.
2. Com login, cada alteração é enviada ao servidor (`web/src/sync.ts`). O envio acontece quando a conexão volta, quando o app é reaberto e a cada 5 minutos.
3. Os IDs são gerados no aparelho e o servidor faz upsert por eles. Assim, reenviar não duplica, e uma alteração antiga que chega atrasada não sobrescreve uma mais nova.
4. As exclusões são lógicas (`deletedAt`), para chegarem também aos outros aparelhos.
5. O treino realizado guarda uma **cópia** dos nomes e da configuração da ficha. Editar a ficha depois não altera o histórico.

## Rodar localmente

```bash
docker compose up -d                 # PostgreSQL
cd api && cp .env.example .env && npm install && npm run dev   # API em :3333
cd web && npm install && npm run dev # front em :5173 (encaminha /api para :3333)
```

- `npm test` em `api/` roda os testes de sincronização. Eles precisam do PostgreSQL ligado.
- `npm test` em `web/` roda os testes da lógica de hábitos e da academia. `npm run lint` roda o ESLint, que também faz parte do `npm run build`; a regra de hooks do React é tratada como erro.
- O service worker só roda no build. Para testar a PWA, use `npm run build` em `web/` e acesse a API (`npm run dev` em `api/`) em http://localhost:3333.
- Para testar a instalação no celular pela rede local, use `npm run dev:celular` (HTTPS com certificado autoassinado).
- `npm run icones` em `web/` gera os ícones de Android, iOS e favicon a partir de `web/public/logo.svg`.

## Publicação no Railway

O app roda como um serviço só: o `Dockerfile` da raiz compila o `web` e a `api`, e a API entrega o front num único endereço HTTPS. O `railway.json` já define o Dockerfile e o healthcheck (`/api/saude`). As migrações rodam sozinhas quando a API inicia.

Passo a passo, num projeto próprio (separado do BarberNexa):

1. **New Project → Deploy from GitHub repo → `BernardoAbudReis/motus`.** O serviço do app é criado a partir da `main`.
2. **+ New → Database → PostgreSQL**, no mesmo projeto.
3. Em **Variables** do serviço do app:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
   | `JWT_SECRET` | valor aleatório de 64 caracteres, ex.: `openssl rand -hex 32` |
   | `NODE_ENV` | `production` (o Dockerfile já define; pode repetir) |

4. **Settings → Networking → Generate Domain** para ter o endereço `*.up.railway.app` com HTTPS. O domínio próprio é opcional.
5. Conferir `https://<endereço>/api/saude`: a resposta deve ser `{"ok":true}`.

O `JWT_SECRET` assina os logins: trocar o valor desconecta todos os usuários. Se o banco recusar SSL na rede interna, use `PGSSLMODE=disable`.

Com o repositório ligado no passo 1, cada push na `main` publica uma nova versão. Os usuários recebem o aviso "Nova versão disponível" dentro do app.
