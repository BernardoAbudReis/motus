create table usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  senha_hash text not null,
  nome text,
  criado_em timestamptz not null default now()
);

-- Todos os dados do usuário (hábitos, registros, fichas, exercícios, sessões
-- de treino e preferências) ficam aqui, um registro por linha, separados por
-- `colecao`. O id vem do aparelho, então reenviar o mesmo registro faz upsert
-- e nunca duplica. `seq` cresce a cada gravação e serve de cursor para cada
-- aparelho buscar só o que mudou desde a última sincronização.
create sequence registros_seq;

create table registros (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  colecao text not null,
  id text not null,
  dados jsonb not null,
  atualizado_em bigint not null, -- ms, definido pelo aparelho na alteração
  excluido_em bigint,            -- exclusão lógica
  seq bigint not null default nextval('registros_seq'),
  primary key (usuario_id, colecao, id)
);

create index registros_usuario_seq on registros (usuario_id, seq);
