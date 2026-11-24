import bcrypt from 'bcryptjs'
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

function gerarToken(usuarioId: string) {
  return jwt.sign({}, segredo, { subject: usuarioId, expiresIn: VALIDADE })
}

export function exigirLogin(req: RequisicaoAutenticada, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return void res.status(401).json({ erro: 'Faça login.' })
  try {
    const { sub } = jwt.verify(token, segredo) as jwt.JwtPayload
    req.usuarioId = sub
    next()
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Faça login de novo.' })
  }
}

const credenciais = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(200),
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200),
  nome: z.string().trim().max(100).optional(),
})

export const rotasAuth = Router()

rotasAuth.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { erro: 'Muitas tentativas. Tente em alguns minutos.' } }))

rotasAuth.post('/cadastro', async (req, res) => {
  const r = credenciais.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: r.error.issues[0].message })
  const { email, senha, nome } = r.data
  const hash = await bcrypt.hash(senha, 12)
  const { rows } = await pool.query<{ id: string; email: string; nome: string | null }>(
    `insert into usuarios (email, senha_hash, nome) values ($1, $2, $3)
     on conflict (email) do nothing returning id, email, nome`,
    [email, hash, nome ?? null],
  )
  if (rows.length === 0) return void res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })
  res.status(201).json({ token: gerarToken(rows[0].id), usuario: rows[0] })
})

rotasAuth.post('/login', async (req, res) => {
  const r = credenciais.safeParse(req.body)
  if (!r.success) return void res.status(400).json({ erro: 'E-mail ou senha incorretos.' })
  const { rows } = await pool.query<{ id: string; email: string; nome: string | null; senha_hash: string }>(
    'select id, email, nome, senha_hash from usuarios where email = $1',
    [r.data.email],
  )
  const usuario = rows[0]
  if (!usuario || !(await bcrypt.compare(r.data.senha, usuario.senha_hash))) {
    return void res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  }
  res.json({ token: gerarToken(usuario.id), usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } })
})
