# MOTUS: hábitos e academia (PWA)

Sistema web instalável (PWA) para hábitos pessoais e treinos de academia. Funciona no navegador do computador, no Android (Chrome) e no iPhone (Safari), sem lojas de aplicativos.

## Identidade visual

- Fundo `#090C15`, superfícies `#111722`, bordas `#252D39`, texto `#F6F5F6`, texto secundário `#A3A5AA`.
- O verde menta `#53E79F` é a única cor de destaque. O verde escuro `#123B2B` serve de fundo de destaque.
- Os tokens ficam em `web/src/estilos.css`. O símbolo está em vetor em `web/public/logo.svg`, e o logo original em `docs/marca/`.
- Cores de hábitos e matérias (`web/src/cores.ts`): 27 tons prontos, sem roxo, azul ou dourado, e a **cor personalizada** (seletor de cores do aparelho, guardada como `#rrggbb`). O texto sobre o card concluído usa a tinta de maior contraste, calculada para cada tema.

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

## Estudos

- Hierarquia: setor → matéria → conteúdo (`setores`, `materias`, `conteudos`). Quem não separa por setor usa o "Geral", criado sozinho.
- **Planejamento** são as `atividades`: um estudo ou uma revisão num dia. **Execução** são as `sessoesEstudo`, com tempo, dificuldade e observações opcionais.
- Nada é concluído nem apagado sozinho. O que passou do dia continua planejado e aparece como atrasado. Reagendar troca a data, mas guarda a `dataOriginal` e cada mudança em `reagendamentos`. Remover marca como "removida", e a atividade continua no histórico.
- A semana não é um registro: sai das datas (segunda a domingo). Por isso o histórico de qualquer semana é só uma consulta. Progresso, tempo estudado e resumos são calculados na hora (`web/src/estudos/logica.ts`).
- Revisão é uma atividade do tipo "revisão", independente do status do conteúdo: um conteúdo concluído pode ter revisões pendentes.

## Lembretes

- Cada conclusão feita no próprio dia grava a hora (`concluidoEm`). O lembrete automático toca na média circular das últimas 20 conclusões; com menos de 3, usa o horário padrão do hábito. Também dá para escolher horário fixo ou desligar, por hábito.
- O navegador não agenda notificações com o app fechado. Por isso o servidor verifica a cada minuto (`api/src/lembretes.ts`), no fuso do aparelho, e envia por Web Push só para hábitos agendados no dia e ainda não concluídos, no máximo um por hábito por dia.
- É preciso estar com a conta conectada. No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo).

## Rodar localmente

```bash
docker compose up -d                 # PostgreSQL
cd api && cp .env.example .env && npm install && npm run dev   # API em :3333
cd web && npm install && npm run dev # front em :5173 (encaminha /api para :3333)
```

- `npm test` em `api/` roda os testes da API (sincronização, conta, backup, lembretes). Precisam do PostgreSQL ligado.
- `npm test` em `web/` roda os testes de unidade (hábitos, academia, estatísticas, lembretes e service worker).
- `npm run build && npm run e2e` em `web/` roda os testes de navegador (Playwright, pasta `web/e2e`), com a API real e o PostgreSQL.
- `npm run lint` roda o ESLint, que também faz parte do `npm run build`; a regra de hooks do React é tratada como erro.
- O workflow `.github/workflows/ci.yml` roda tudo isso a cada push e pull request.
- O service worker só roda no build. Para testar a PWA, use `npm run build` em `web/` e acesse a API (`npm run dev` em `api/`) em http://localhost:3333.
- Para testar a instalação no celular pela rede local, use `npm run dev:celular` (HTTPS com certificado autoassinado).
- `npm run icones` em `web/` gera os ícones de Android, iOS e favicon a partir de `web/public/logo.svg`.

## Conta e dados

- **Recuperação de senha sem e-mail**: ao criar a conta, o app mostra uma única vez um código de recuperação (`XXXX-XXXX-XXXX-XXXX`). Em "Esqueci minha senha", ele redefine a senha. O código é trocado a cada uso, o servidor guarda só o hash, e dá para gerar outro em Configurações.
- Trocar ou redefinir a senha desconecta os outros aparelhos (versão da sessão no token).
- Excluir a conta apaga tudo no servidor. Os dados do aparelho ficam até o usuário apagá-los em Configurações → Dados.
- Exportar e importar todos os dados em JSON funciona sem conta e sem internet. Importar só traz o que for mais novo que o do aparelho.
- O servidor confere o formato de cada tipo de dado (`api/src/validacao.ts`). Um registro inválido é descartado sozinho, sem travar o resto do lote.

## Backup

- O servidor gera uma cópia completa dos dados por dia (`api/src/backup.ts`) no volume `/dados` do Railway, separado do volume do banco, e guarda as 14 mais recentes.
- Para baixar uma cópia, use `railway volume files` no volume `motus-backups`.
- Para restaurar, rode `npm run restaurar -- arquivo.json.gz` em `api/`, com `DATABASE_URL` apontando para o banco. Por padrão, só insere o que falta. Com `--substituir`, sobrescreve os registros de mesmo id.
- Recomendado também: o backup nativo do Railway no volume do Postgres (painel → Postgres → Backups).

## Publicação no Railway

O app roda como um serviço só: o `Dockerfile` da raiz compila o `web` e a `api`, e a API entrega o front num único endereço HTTPS. As migrações rodam sozinhas quando a API inicia.

A configuração do serviço fica em `.railway/railway.ts`: Dockerfile, healthcheck em `/api/saude` e o volume de backup. Ela gerencia só o serviço `app`; o banco e as variáveis ficam de fora. Para conferir ou aplicar mudanças, rode `npm install` na raiz e depois `railway config plan` ou `railway config apply`.

Para publicar, extraia uma cópia limpa com `git archive main` para uma pasta e rode `railway up` com essa pasta, `--path-as-root --service app --ci`.

Como o projeto foi montado (separado do BarberNexa):

1. **New Project → Deploy from GitHub repo → `BernardoAbudReis/motus`.** O serviço do app é criado a partir da `main`.
   O repositório pertence à conta `BernardoAbudReis`. Para o Railway enxergá-lo, o aplicativo **Railway** do GitHub precisa estar instalado nessa conta, com acesso ao `motus`. Quem faz isso é o dono, em GitHub → Settings → Applications. Sem essa instalação, dá para publicar pela CLI, como descrito acima.
2. **+ New → Database → PostgreSQL**, no mesmo projeto.
3. Em **Variables** do serviço do app:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
   | `JWT_SECRET` | valor aleatório de 64 caracteres, ex.: `openssl rand -hex 32` |
   | `NODE_ENV` | `production` (o Dockerfile já define; pode repetir) |
   | `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` | par de chaves dos lembretes (Web Push). Gere com `npx web-push generate-vapid-keys`; sem elas, os lembretes ficam desligados e o resto funciona |
   | `VAPID_SUBJECT` (opcional) | contato `https:` ou `mailto:` para os serviços de push. No Railway, o padrão é o domínio público do serviço |

4. **Settings → Networking → Generate Domain** para ter o endereço `*.up.railway.app` com HTTPS. O domínio próprio é opcional.
5. Conferir `https://<endereço>/api/saude`: a resposta deve ser `{"ok":true}`.

O `JWT_SECRET` assina os logins: trocar o valor desconecta todos os usuários. Se o banco recusar SSL na rede interna, use `PGSSLMODE=disable`.

Com o repositório ligado no passo 1, cada push na `main` publica uma nova versão. Os usuários recebem o aviso "Nova versão disponível" dentro do app.
