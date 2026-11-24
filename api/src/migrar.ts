import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pool } from './banco.js'

const PASTA = fileURLToPath(new URL('../migrations/', import.meta.url))

/** Aplica, em ordem, os arquivos .sql de migrations/ que ainda não rodaram. */
export async function migrar() {
  await pool.query('create table if not exists migracoes (nome text primary key, aplicada_em timestamptz not null default now())')
  const aplicadas = new Set((await pool.query<{ nome: string }>('select nome from migracoes')).rows.map((r) => r.nome))
  const arquivos = (await readdir(PASTA)).filter((a) => a.endsWith('.sql')).sort()

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue
    const sql = await readFile(PASTA + arquivo, 'utf8')
    const cliente = await pool.connect()
    try {
      await cliente.query('begin')
      await cliente.query(sql)
      await cliente.query('insert into migracoes (nome) values ($1)', [arquivo])
      await cliente.query('commit')
      console.log(`Migração aplicada: ${arquivo}`)
    } catch (e) {
      await cliente.query('rollback')
      throw e
    } finally {
      cliente.release()
    }
  }
}

// Executado direto (`npm run migrar`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrar()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
