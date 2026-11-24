# MOTUS: uma imagem só. A API (Express) entrega também o front (PWA) já compilado.

FROM node:24-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM node:24-alpine AS api
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
# su-exec: o container começa como root só para liberar o volume de backup e
# logo passa a rodar o app como o usuário sem privilégios "node".
RUN apk add --no-cache su-exec
WORKDIR /app
# Mesma estrutura de pastas do repositório: a API procura o front em ../../web/dist.
COPY --from=api /app/api/package.json api/package.json
COPY --from=api /app/api/node_modules api/node_modules
COPY --from=api /app/api/dist api/dist
COPY --from=api /app/api/migrations api/migrations
COPY --from=web /app/web/dist web/dist
WORKDIR /app/api
EXPOSE 3333
# O Railway monta o volume (/dados) como root: ajusta o dono e só então inicia o app como "node".
CMD ["sh", "-c", "mkdir -p /dados/backups && chown -R node:node /dados && exec su-exec node node dist/index.js"]
