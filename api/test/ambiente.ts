// Ambiente dos testes: carregado antes de qualquer módulo do app (--import).
// Os testes fazem dezenas de logins seguidos; o limite contra força bruta continua 20 em produção.
process.env.AUTH_LIMITE ??= '1000'
