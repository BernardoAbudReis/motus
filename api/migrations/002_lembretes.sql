-- Aparelhos inscritos para receber lembretes (Web Push). Um usuário pode ter vários.
create table push_inscricoes (
  endpoint text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  fuso text not null, -- fuso horário do aparelho, ex.: America/Sao_Paulo
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index push_inscricoes_usuario on push_inscricoes (usuario_id);

-- Garante um lembrete por hábito por dia, mesmo com o agendador rodando de novo.
create table lembretes_enviados (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  habito_id text not null,
  data text not null, -- AAAA-MM-DD no fuso do usuário
  enviado_em timestamptz not null default now(),
  primary key (usuario_id, habito_id, data)
);
