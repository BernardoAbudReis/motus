import { Router } from 'express'
import { z } from 'zod'
import { emTransacao } from './banco.js'
import { exigirLogin, type RequisicaoAutenticada } from './auth.js'
import { COLECOES, validarRegistro, type Colecao } from './validacao.js'

const mudanca = z.object({
  colecao: z.enum(COLECOES as [Colecao, ...Colecao[]]),
  id: z.string().min(1).max(120),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
  dados: z.record(z.string(), z.unknown()),
})

const corpoPush = z.object({ mudancas: z.array(mudanca).max(500) })

const LIMITE_PULL = 500

export const rotasSync = Router()
rotasSync.use(exigirLogin)

/**
 * Recebe alterações do aparelho. Upsert por (usuário, coleção, id) e só grava
 * se a alteração for mais nova que a do servidor: reenviar não duplica e uma
 * alteração antiga que chega atrasada não apaga uma mais nova.
 */
rotasSync.post('/push', async (req: RequisicaoAutenticada, res) => {
  const r = corpoPush.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: 'Dados de sincronização inválidos.' })
  const usuarioId = req.usuarioId!
  // Um relógio adiantado no aparelho não pode fazer a alteração "vencer para sempre".
  const agora = Date.now()
  // Registro fora do formato é descartado sozinho (o resto do lote é gravado):
  // um item com defeito não pode travar a sincronização do aparelho.
  const rejeitados: { colecao: string; id: string; motivo: string }[] = []
  const validas = r.data.mudancas.filter((m) => {
    const motivo = validarRegistro(m.colecao, m.id, m.dados)
    if (motivo) rejeitados.push({ colecao: m.colecao, id: m.id, motivo })
    return !motivo
  })
  if (rejeitados.length) console.warn(`Sync: ${rejeitados.length} registro(s) rejeitado(s)`, rejeitados.slice(0, 3))

  await emTransacao(async (c) => {
    // Pushes do mesmo usuário em fila: o seq fica na ordem de gravação e o pull não pula nada.
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [usuarioId])
    for (const m of validas) {
      const atualizado = Math.min(m.updatedAt, agora)
      await c.query(
        `insert into registros (usuario_id, colecao, id, dados, atualizado_em, excluido_em)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (usuario_id, colecao, id) do update
           set dados = excluded.dados,
               atualizado_em = excluded.atualizado_em,
               excluido_em = excluded.excluido_em,
               seq = nextval('registros_seq')
         where registros.atualizado_em < excluded.atualizado_em`,
        [usuarioId, m.colecao, m.id, m.dados, atualizado, m.deletedAt === null ? null : Math.min(m.deletedAt, agora)],
      )
    }
  })
  res.json({ ok: true, rejeitados })
})

/** Devolve o que mudou depois do cursor `desde`, em lotes. */
rotasSync.get('/pull', async (req: RequisicaoAutenticada, res) => {
  const desde = Number(req.query.desde ?? 0)
  if (!Number.isSafeInteger(desde) || desde < 0) return void res.status(400).json({ erro: 'Cursor inválido.' })

  const linhas = await emTransacao(async (c) => {
    // Espera um push em andamento terminar, para não pular seq ainda não confirmado.
    await c.query('select pg_advisory_xact_lock_shared(hashtext($1))', [req.usuarioId])
    const { rows } = await c.query<{
      colecao: string
      id: string
      dados: Record<string, unknown>
      atualizado_em: string
      excluido_em: string | null
      seq: string
    }>(
      `select colecao, id, dados, atualizado_em, excluido_em, seq from registros
       where usuario_id = $1 and seq > $2 order by seq limit $3`,
      [req.usuarioId, desde, LIMITE_PULL],
    )
    return rows
  })

  res.json({
    mudancas: linhas.map((l) => ({
      colecao: l.colecao,
      id: l.id,
      dados: l.dados,
      updatedAt: Number(l.atualizado_em),
      deletedAt: l.excluido_em === null ? null : Number(l.excluido_em),
    })),
    cursor: linhas.length ? Number(linhas[linhas.length - 1].seq) : desde,
    temMais: linhas.length === LIMITE_PULL,
  })
})
