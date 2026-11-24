import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Defina DATABASE_URL (veja api/.env.example).')

// Bancos gerenciados costumam exigir SSL; o Postgres local não.
// PGSSLMODE=disable desliga o SSL quando a rede já é privada.
const semSsl = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || process.env.PGSSLMODE === 'disable'

export const pool = new pg.Pool({
  connectionString: url,
  ssl: semSsl ? false : { rejectUnauthorized: false },
  max: 5,
})

export async function emTransacao<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const resultado = await fn(cliente)
    await cliente.query('commit')
    return resultado
  } catch (e) {
    await cliente.query('rollback')
    throw e
  } finally {
    cliente.release()
  }
}
