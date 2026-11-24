import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { pool } from './banco.js'

/**
 * Backup próprio do MOTUS: uma cópia completa dos dados (contas e todos os
 * registros sincronizados) por dia, em JSON comprimido, num volume separado do
 * banco (/dados no Railway). Mantém as 14 mais recentes.
 * Inscrições de notificação e o controle de lembretes enviados ficam de fora:
 * são refeitos sozinhos.
 */

export const PASTA_BACKUP = process.env.BACKUP_DIR ?? '/dados/backups'
const MANTER = 14
const UM_DIA = 86_400_000

export interface ConteudoBackup {
  versao: 1
  geradoEm: string
  usuarios: { id: string; email: string; senha_hash: string; nome: string | null; criado_em: string; codigo_recuperacao_hash?: string | null }[]
  registros: { usuario_id: string; colecao: string; id: string; dados: unknown; atualizado_em: string; excluido_em: string | null }[]
}

function nomeDoArquivo(data = new Date()) {
  return `motus-${data.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json.gz`
}

async function arquivos(pasta: string) {
  try {
    return (await readdir(pasta)).filter((a) => a.startsWith('motus-') && a.endsWith('.json.gz')).sort()
  } catch {
    return []
  }
}

export async function gerarBackup(pasta = PASTA_BACKUP) {
  const usuarios = await pool.query<ConteudoBackup['usuarios'][number]>('select * from usuarios order by criado_em')
  const registros = await pool.query<ConteudoBackup['registros'][number]>(
    'select usuario_id, colecao, id, dados, atualizado_em, excluido_em from registros order by usuario_id, colecao, id',
  )
  const conteudo: ConteudoBackup = { versao: 1, geradoEm: new Date().toISOString(), usuarios: usuarios.rows, registros: registros.rows }
  const bytes = gzipSync(JSON.stringify(conteudo))

  await mkdir(pasta, { recursive: true })
  const nome = nomeDoArquivo()
  // Grava num temporário e renomeia: nunca deixa um backup pela metade com nome válido.
  await writeFile(join(pasta, `${nome}.tmp`), bytes)
  await rename(join(pasta, `${nome}.tmp`), join(pasta, nome))

  const todos = await arquivos(pasta)
  for (const antigo of todos.slice(0, Math.max(0, todos.length - MANTER))) await rm(join(pasta, antigo))

  return { arquivo: join(pasta, nome), usuarios: usuarios.rowCount ?? 0, registros: registros.rowCount ?? 0, bytes: bytes.length }
}

/** Gera um backup se o mais recente tiver mais de um dia. Confere de hora em hora. */
export function iniciarBackups(pasta = PASTA_BACKUP) {
  const verificar = async () => {
    try {
      const todos = await arquivos(pasta)
      const ultimo = todos.at(-1)
      const idade = ultimo ? Date.now() - (await stat(join(pasta, ultimo))).mtimeMs : Infinity
      if (idade < UM_DIA) return
      const r = await gerarBackup(pasta)
      console.log(`Backup gerado: ${r.arquivo} (${r.usuarios} contas, ${r.registros} registros, ${Math.round(r.bytes / 1024)} KB)`)
    } catch (e) {
      console.error('Falha no backup:', (e as Error).message)
    }
  }
  setTimeout(() => void verificar(), 30_000)
  setInterval(() => void verificar(), 60 * 60_000)
}
