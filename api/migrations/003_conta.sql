-- Recuperação de senha sem e-mail: código mostrado uma vez ao usuário; aqui só o hash.
alter table usuarios add column codigo_recuperacao_hash text;

-- Versão da sessão: muda ao trocar ou redefinir a senha, invalidando os
-- logins dos outros aparelhos (o token carrega a versão em que foi emitido).
alter table usuarios add column sessao_versao integer not null default 0;
