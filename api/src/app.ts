import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rotasAuth } from './auth.js'
import { pool } from './banco.js'
import { rotasSync } from './sync.js'

export function criarApp() {
  const app = express()
  app.set('trust proxy', 1) // atrás do proxy HTTPS da hospedagem
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // blob: para reduzir a foto do exercício no aparelho antes de salvar.
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  )
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/saude', async (_req, res) => {
    await pool.query('select 1')
    res.json({ ok: true })
  })
  app.use('/api/auth', rotasAuth)
  app.use('/api/sync', rotasSync)
  app.use('/api', (_req, res) => void res.status(404).json({ erro: 'Rota não encontrada.' }))

  // Em produção, o mesmo serviço entrega o front (web/dist): um endereço só, com HTTPS.
  const dist = fileURLToPath(new URL('../../web/dist/', import.meta.url))
  if (existsSync(dist)) {
    app.use(
      express.static(dist, {
        setHeaders(res, caminho) {
          // index.html e o service worker nunca ficam em cache, senão a atualização não chega.
          if (/(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(caminho)) {
            res.setHeader('Cache-Control', 'no-cache')
          } else if (caminho.includes('assets')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        },
      }),
    )
    app.get('/{*caminho}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(dist + 'index.html')
    })
  }

  app.use((erro: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno. Tente de novo.' })
  })

  return app
}
