import { defineRailway, project, service, volume } from "railway/iac";

// Configuração do Railway para o MOTUS (substitui o antigo railway.json).
// Este repositório gerencia só o serviço "app": o banco (Postgres) e as
// variáveis (segredos) ficam fora daqui e não são tocados pelo `config apply`.
// Ver https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "app";

export default defineRailway(() => {
  // Backup próprio do MOTUS (api/src/backup.ts): cópias diárias dos dados,
  // num volume separado do volume do banco.
  const backups = volume("motus-backups", { sizeMB: 1000 });

  const app = service("app", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/saude",
    healthcheckTimeout: 60,
    replicas: { "us-west2": 1 },
    volumeMounts: { "/dados": backups },
  });

  return project("Motus", {
    variables: { managed: false },
    resources: [app, backups],
  });
});
