import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import type { ConteudoBackup } from './backup.js'
import { emTransacao, pool } from './banco.js'

/**
 * Restaura um backup gerado por backup.ts.
 * Padrão: só insere o que não existe (não sobrescreve nada). Com
 * `substituir`, o registro do backup substitui o atual quando os ids coincidem.
 */
export async function restaurarBackup(arquivo: string, { substituir = false } = {}) {
  const conteudo = JSON.parse(gunzipSync(await readFile(arquivo)).toString('utf8')) as ConteudoBackup
  if (conteudo.versao !== 1) throw new Error(`Versão de backup desconhecida: ${conteudo.versao}`)

  return emTransacao(async (c) => {
    let usuarios = 0
    let registros = 0
    for (const u of conteudo.usuarios) {
      const r = await c.query(
        `insert into usuarios (id, email, senha_hash, nome, criado_em) values ($1, $2, $3, $4, $5)
         on conflict (id) do ${substituir ? 'update set email = excluded.email, senha_hash = excluded.senha_hash, nome = excluded.nome' : 'nothing'}`,
        [u.id, u.email, u.senha_hash, u.nome, u.criado_em],
      )
      usuarios += r.rowCount ?? 0
      if (u.codigo_recuperacao_hash !== undefined) {
        await c.query('update usuarios set codigo_recuperacao_hash = coalesce(codigo_recuperacao_hash, $2) where id = $1', [
          u.id,
          u.codigo_recuperacao_hash,
        ])
      }
    }
    for (const r of conteudo.registros) {
      const res = await c.query(
        `insert into registros (usuario_id, colecao, id, dados, atualizado_em, excluido_em) values ($1, $2, $3, $4, $5, $6)
         on conflict (usuario_id, colecao, id) do ${
           substituir
             ? "update set dados = excluded.dados, atualizado_em = excluded.atualizado_em, excluido_em = excluded.excluido_em, seq = nextval('registros_seq')"
             : 'nothing'
         }`,
        [r.usuario_id, r.colecao, r.id, r.dados, r.atualizado_em, r.excluido_em],
      )
      registros += res.rowCount ?? 0
    }
    return { usuarios, registros, geradoEm: conteudo.geradoEm }
  })
}

// Uso: npm run restaurar -- <arquivo.json.gz> [--substituir]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arquivo = process.argv[2]
  if (!arquivo) {
    console.error('Uso: npm run restaurar -- <arquivo.json.gz> [--substituir]')
    process.exit(1)
  }
  restaurarBackup(arquivo, { substituir: process.argv.includes('--substituir') })
    .then((r) => console.log(`Restaurado (backup de ${r.geradoEm}): ${r.usuarios} contas e ${r.registros} registros gravados.`))
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
