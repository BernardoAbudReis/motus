import { Router } from 'express'
import { z } from 'zod'
import { pool } from './banco.js'
import { exigirLogin, type RequisicaoAutenticada } from './auth.js'
import { enviarParaUsuario, fusoValido, pushDisponivel } from './lembretes.js'

const producao = process.env.NODE_ENV === 'production'

const corpoInscricao = z.object({
  inscricao: z.object({
    // Em produção só aceita serviços de push com HTTPS.
    endpoint: z.string().url().max(1000).refine((u) => u.startsWith('https://') || !producao, 'Endpoint inválido.'),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  fuso: z.string().max(80).refine(fusoValido, 'Fuso horário inválido.'),
})

export const rotasPush = Router()

/** Chave pública (VAPID) que o navegador usa para se inscrever. */
rotasPush.get('/chave', (_req, res) => {
  if (!pushDisponivel()) return void res.status(503).json({ erro: 'Lembretes indisponíveis no servidor.' })
  res.json({ chave: process.env.VAPID_PUBLIC_KEY })
})

rotasPush.use(exigirLogin)

rotasPush.post('/inscricoes', async (req: RequisicaoAutenticada, res) => {
  const r = corpoInscricao.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: r.error.issues[0].message })
  const { inscricao, fuso } = r.data
  // O mesmo aparelho pode trocar de conta: o endpoint passa a ser do usuário atual.
  await pool.query(
    `insert into push_inscricoes (endpoint, usuario_id, p256dh, auth, fuso) values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh,
       auth = excluded.auth, fuso = excluded.fuso, atualizado_em = now()`,
    [inscricao.endpoint, req.usuarioId, inscricao.keys.p256dh, inscricao.keys.auth, fuso],
  )
  res.status(201).json({ ok: true })
})

rotasPush.delete('/inscricoes', async (req: RequisicaoAutenticada, res) => {
  const endpoint = z.string().max(1000).safeParse(req.body?.endpoint)
  if (!endpoint.success) return void res.status(400).json({ erro: 'Endpoint inválido.' })
  await pool.query('delete from push_inscricoes where endpoint = $1 and usuario_id = $2', [endpoint.data, req.usuarioId])
  res.json({ ok: true })
})

/**
 * Fim do descanso entre séries com o app em segundo plano (tela bloqueada):
 * o navegador congela os cronômetros do app, então o servidor avisa na hora.
 * Um agendamento por usuário (o novo substitui o anterior); fica só em
 * memória, porque descansos duram minutos.
 */
const descansos = new Map<string, ReturnType<typeof setTimeout>>()

rotasPush.post('/descanso', (req: RequisicaoAutenticada, res) => {
  if (!pushDisponivel()) return void res.status(503).json({ erro: 'Lembretes indisponíveis no servidor.' })
  const r = z.object({ segundos: z.number().int().min(1).max(900), exercicio: z.string().max(120).optional() }).safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: 'Descanso inválido.' })
  const usuarioId = req.usuarioId!
  clearTimeout(descansos.get(usuarioId))
  descansos.set(
    usuarioId,
    setTimeout(() => {
      descansos.delete(usuarioId)
      void enviarParaUsuario(usuarioId, {
        titulo: 'Descanso terminado',
        corpo: r.data.exercicio ? `Hora da próxima série de ${r.data.exercicio}.` : 'Hora da próxima série.',
        tag: 'descanso',
        url: '/#academia',
        tipo: 'descanso',
      })
    }, r.data.segundos * 1000),
  )
  res.json({ ok: true })
})

rotasPush.delete('/descanso', (req: RequisicaoAutenticada, res) => {
  clearTimeout(descansos.get(req.usuarioId!))
  descansos.delete(req.usuarioId!)
  res.json({ ok: true })
})

/** Notificação de teste para todos os aparelhos do usuário. */
rotasPush.post('/teste', async (req: RequisicaoAutenticada, res) => {
  if (!pushDisponivel()) return void res.status(503).json({ erro: 'Lembretes indisponíveis no servidor.' })
  const resultado = await enviarParaUsuario(req.usuarioId!, {
    titulo: 'MOTUS',
    corpo: 'Tudo certo! Os lembretes vão chegar neste aparelho.',
    tag: 'teste',
    url: '/#configuracoes',
  })
  res.json(resultado)
})
