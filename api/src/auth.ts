import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { pool } from './banco.js'

const SEGREDO = process.env.JWT_SECRET ?? ''
if (process.env.NODE_ENV === 'production' && SEGREDO.length < 32) {
  throw new Error('Em produção, JWT_SECRET precisa ter pelo menos 32 caracteres.')
}
const segredo = SEGREDO || 'segredo-de-desenvolvimento'

// Token longo: o app instalado fica dias offline e não deve pedir login de novo.
const VALIDADE = '90d'

export interface RequisicaoAutenticada extends Request {
  usuarioId?: string
}

interface Usuario {
  id: string
  email: string
  nome: string | null
}

function gerarToken(usuarioId: string, versao: number) {
  return jwt.sign({ v: versao }, segredo, { subject: usuarioId, expiresIn: VALIDADE })
}

/**
 * Exige um token válido, de uma conta que ainda existe e emitido depois da
 * última troca de senha (versão da sessão).
 */
export async function exigirLogin(req: RequisicaoAutenticada, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return void res.status(401).json({ erro: 'Faça login.' })
  let carga: jwt.JwtPayload
  try {
    carga = jwt.verify(token, segredo) as jwt.JwtPayload
  } catch {
    return void res.status(401).json({ erro: 'Sessão expirada. Faça login de novo.' })
  }
  const { rows } = await pool.query<{ sessao_versao: number }>('select sessao_versao from usuarios where id = $1', [carga.sub])
  if (!rows[0] || rows[0].sessao_versao !== (carga.v ?? 0)) {
    return void res.status(401).json({ erro: 'Sessão expirada. Faça login de novo.' })
  }
  req.usuarioId = carga.sub
  next()
}

/** Código de recuperação: 16 caracteres sem letras/números confundíveis, em 4 grupos. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export function gerarCodigo() {
  const c = Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
  return c.match(/.{4}/g)!.join('-')
}
const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

async function novoCodigo(usuarioId: string) {
  const codigo = gerarCodigo()
  await pool.query('update usuarios set codigo_recuperacao_hash = $2 where id = $1', [usuarioId, await bcrypt.hash(normalizarCodigo(codigo), 10)])
  return codigo
}

const email = z.string().trim().toLowerCase().email('E-mail inválido.').max(200)
const senha = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200)
const credenciais = z.object({ email, senha, nome: z.string().trim().max(100).optional() })

export const rotasAuth = Router()

// Contra força bruta: 20 tentativas a cada 15 min por IP (AUTH_LIMITE muda isso nos testes).
rotasAuth.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_LIMITE ?? 20), message: { erro: 'Muitas tentativas. Tente em alguns minutos.' } }))

rotasAuth.post('/cadastro', async (req, res) => {
  const r = credenciais.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: r.error.issues[0].message })
  const hash = await bcrypt.hash(r.data.senha, 12)
  const { rows } = await pool.query<Usuario>(
    `insert into usuarios (email, senha_hash, nome) values ($1, $2, $3)
     on conflict (email) do nothing returning id, email, nome`,
    [r.data.email, hash, r.data.nome ?? null],
  )
  if (rows.length === 0) return void res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })
  const codigoRecuperacao = await novoCodigo(rows[0].id)
  res.status(201).json({ token: gerarToken(rows[0].id, 0), usuario: rows[0], codigoRecuperacao })
})

rotasAuth.post('/login', async (req, res) => {
  const r = credenciais.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: 'E-mail ou senha incorretos.' })
  const { rows } = await pool.query<Usuario & { senha_hash: string; sessao_versao: number }>(
    'select id, email, nome, senha_hash, sessao_versao from usuarios where email = $1',
    [r.data.email],
  )
  const u = rows[0]
  if (!u || !(await bcrypt.compare(r.data.senha, u.senha_hash))) {
    return void res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  }
  res.json({ token: gerarToken(u.id, u.sessao_versao), usuario: { id: u.id, email: u.email, nome: u.nome } })
})

/**
 * Redefine a senha com o código de recuperação. O código é trocado (o antigo
 * deixa de valer) e os outros aparelhos são desconectados.
 */
rotasAuth.post('/redefinir-senha', async (req, res) => {
  const r = z.object({ email, codigo: z.string().max(40), novaSenha: senha }).safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: r.error.issues[0].message })
  const { rows } = await pool.query<Usuario & { codigo_recuperacao_hash: string | null }>(
    'select id, email, nome, codigo_recuperacao_hash from usuarios where email = $1',
    [r.data.email],
  )
  const u = rows[0]
  const valido = !!u?.codigo_recuperacao_hash && (await bcrypt.compare(normalizarCodigo(r.data.codigo), u.codigo_recuperacao_hash))
  if (!u || !valido) return void res.status(401).json({ erro: 'E-mail ou código de recuperação incorretos.' })
  const { rows: atual } = await pool.query<{ sessao_versao: number }>(
    'update usuarios set senha_hash = $2, sessao_versao = sessao_versao + 1 where id = $1 returning sessao_versao',
    [u.id, await bcrypt.hash(r.data.novaSenha, 12)],
  )
  const codigoRecuperacao = await novoCodigo(u.id)
  res.json({ token: gerarToken(u.id, atual[0].sessao_versao), usuario: { id: u.id, email: u.email, nome: u.nome }, codigoRecuperacao })
})

async function conferirSenha(usuarioId: string, senhaInformada: unknown) {
  if (typeof senhaInformada !== 'string') return false
  const { rows } = await pool.query<{ senha_hash: string }>('select senha_hash from usuarios where id = $1', [usuarioId])
  return !!rows[0] && bcrypt.compare(senhaInformada, rows[0].senha_hash)
}

rotasAuth.post('/codigo-recuperacao', exigirLogin, async (req: RequisicaoAutenticada, res) => {
  if (!(await conferirSenha(req.usuarioId!, req.body?.senha))) return void res.status(401).json({ erro: 'Senha incorreta.' })
  res.json({ codigoRecuperacao: await novoCodigo(req.usuarioId!) })
})

/** Troca a senha e desconecta os outros aparelhos (este recebe um token novo). */
rotasAuth.post('/trocar-senha', exigirLogin, async (req: RequisicaoAutenticada, res) => {
  const nova = senha.safeParse(req.body?.novaSenha)
  if (!nova.success) return void res.status(400).json({ erro: nova.error.issues[0].message })
  if (!(await conferirSenha(req.usuarioId!, req.body?.senhaAtual))) return void res.status(401).json({ erro: 'Senha atual incorreta.' })
  const { rows } = await pool.query<{ sessao_versao: number }>(
    'update usuarios set senha_hash = $2, sessao_versao = sessao_versao + 1 where id = $1 returning sessao_versao',
    [req.usuarioId, await bcrypt.hash(nova.data, 12)],
  )
  res.json({ token: gerarToken(req.usuarioId!, rows[0].sessao_versao) })
})

/** Exclui a conta e todos os dados no servidor (registros, inscrições de notificação). */
rotasAuth.delete('/conta', exigirLogin, async (req: RequisicaoAutenticada, res) => {
  if (!(await conferirSenha(req.usuarioId!, req.body?.senha))) return void res.status(401).json({ erro: 'Senha incorreta.' })
  await pool.query('delete from usuarios where id = $1', [req.usuarioId])
  res.json({ ok: true })
})
