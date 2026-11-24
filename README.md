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
- `npm test` em `web/` roda os testes da lógica de hábitos (agenda, sequência e percentuais).
- O service worker só roda no build. Para testar a PWA, use `npm run build` em `web/` e acesse a API (`npm run dev` em `api/`) em http://localhost:3333.
- Para testar a instalação no celular pela rede local, use `npm run dev:celular` (HTTPS com certificado autoassinado).
- `npm run icones` em `web/` gera os ícones de Android, iOS e favicon a partir de `web/public/logo.svg`.

## Publicação (pendente)

O serviço é um só: `web` é compilado e a `api` o entrega, com um único endereço HTTPS. Variáveis: `DATABASE_URL`, `JWT_SECRET` (32+ caracteres) e `NODE_ENV=production`. As migrações rodam sozinhas quando a API inicia.
