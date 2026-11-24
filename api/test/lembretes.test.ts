import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createECDH, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { generateVAPIDKeys } from 'web-push'
import { pool } from '../src/banco.js'
import { configurarPush, enviarParaUsuario, lembretesDevidos, mediaCircular, relogioNoFuso, verificarLembretes, type HabitoDados } from '../src/lembretes.js'
import { migrar } from '../src/migrar.js'

const FUSO = 'America/Sao_Paulo'
// 24/11/2026 (terça) 10:00 em São Paulo (UTC−3).
const AGORA = Date.UTC(2026, 10, 24, 13, 0)
const emSP = (dia: number, h: number, m = 0) => Date.UTC(2026, 10, dia, h + 3, m)

function habito(campos: Partial<HabitoDados> = {}): HabitoDados {
  return { nome: 'Ler', icone: '📖', frequencia: { tipo: 'diaria' }, criadoEm: emSP(1, 8), ...campos }
}

describe('contas', () => {
  test('configuração VAPID inválida desliga os lembretes sem derrubar o servidor', () => {
    const chaves = generateVAPIDKeys()
    process.env.VAPID_PUBLIC_KEY = chaves.publicKey
    process.env.VAPID_PRIVATE_KEY = chaves.privateKey
    process.env.VAPID_SUBJECT = 'http://nao-https'
    assert.equal(configurarPush(), false)
    delete process.env.VAPID_SUBJECT
  })

  test('relógio no fuso do aparelho', () => {
    assert.deepEqual(relogioNoFuso(AGORA, FUSO), { data: '2026-11-24', minutos: 600 })
  })

  test('média circular atravessa a meia-noite', () => {
    assert.equal(mediaCircular([23 * 60 + 50, 10]), 0)
  })

  test('avisa no horário fixo, dentro da janela', () => {
    const h = habito({ lembrete: { ativo: true, modo: 'fixo', horario: '10:00' } })
    assert.equal(lembretesDevidos([{ id: 'a', dados: h }], [], AGORA, FUSO).length, 1)
    assert.equal(lembretesDevidos([{ id: 'a', dados: h }], [], AGORA - 60_000, FUSO).length, 0) // 09:59: cedo
    assert.equal(lembretesDevidos([{ id: 'a', dados: h }], [], AGORA + 50 * 60_000, FUSO).length, 0) // passou da janela
  })

  test('automático usa a média das conclusões, no fuso do aparelho', () => {
    const h = habito() // lembrete ausente = padrão (automático)
    const registros = [21, 22, 23].map((d) => ({ habitoId: 'a', data: `2026-11-${d}`, concluido: true, concluidoEm: emSP(d, 9, 50) }))
    const r = lembretesDevidos([{ id: 'a', dados: h }], registros, emSP(24, 9, 50), FUSO)
    assert.equal(r.length, 1)
    assert.match(r[0].corpo, /09:50/)
  })

  test('não avisa: já feito hoje, fora da frequência, arquivado ou desligado', () => {
    const fixo = { ativo: true, modo: 'fixo' as const, horario: '10:00' }
    const feitoHoje = [{ habitoId: 'a', data: '2026-11-24', concluido: true, concluidoEm: emSP(24, 7) }]
    assert.equal(lembretesDevidos([{ id: 'a', dados: habito({ lembrete: fixo }) }], feitoHoje, AGORA, FUSO).length, 0)
    assert.equal(
      lembretesDevidos([{ id: 'a', dados: habito({ lembrete: fixo, frequencia: { tipo: 'dias', dias: [1, 3] } }) }], [], AGORA, FUSO).length,
      0,
    )
    assert.equal(lembretesDevidos([{ id: 'a', dados: habito({ lembrete: fixo, arquivado: true }) }], [], AGORA, FUSO).length, 0)
    assert.equal(lembretesDevidos([{ id: 'a', dados: habito({ lembrete: { ...fixo, ativo: false } }) }], [], AGORA, FUSO).length, 0)
  })
})

describe('agendador e envio', () => {
  let usuarioId = ''
  let servidor: Server
  let porta = 0
  const recebidos: { url: string; status: number }[] = []
  let respostaPadrao = 201

  before(async () => {
    await migrar()
    const chaves = generateVAPIDKeys()
    process.env.VAPID_PUBLIC_KEY = chaves.publicKey
    process.env.VAPID_PRIVATE_KEY = chaves.privateKey
    configurarPush()

    // Serviço de push falso, com HTTPS (a biblioteca só envia por HTTPS).
    const pasta = mkdtempSync(join(process.env.TEMP ?? tmpdir(), 'motus-push-'))
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', join(pasta, 'k.pem'), '-out', join(pasta, 'c.pem')], {
      stdio: 'ignore',
    })
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // só neste processo de teste
    servidor = createServer({ key: readFileSync(join(pasta, 'k.pem')), cert: readFileSync(join(pasta, 'c.pem')) }, (req, res) => {
      const status = req.url?.includes('expirada') ? 410 : respostaPadrao
      req.resume()
      req.on('end', () => {
        recebidos.push({ url: req.url ?? '', status })
        res.writeHead(status).end()
      })
    })
    await new Promise<void>((ok) => servidor.listen(0, ok))
    porta = (servidor.address() as AddressInfo).port

    const { rows } = await pool.query<{ id: string }>(
      `insert into usuarios (email, senha_hash) values ($1, 'x') returning id`,
      [`lembrete${Date.now()}@teste.local`],
    )
    usuarioId = rows[0].id
  })

  after(async () => {
    servidor.close()
    await pool.query("delete from usuarios where email like '%@teste.local'")
    await pool.end()
  })

  function chavesDoAparelho() {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
  }

  async function inscrever(caminho: string) {
    const k = chavesDoAparelho()
    await pool.query(`insert into push_inscricoes (endpoint, usuario_id, p256dh, auth, fuso) values ($1, $2, $3, $4, $5)`, [
      `https://localhost:${porta}/${caminho}`,
      usuarioId,
      k.p256dh,
      k.auth,
      FUSO,
    ])
  }

  test('envia uma vez por dia para o hábito pendente', async () => {
    await inscrever('push/aparelho-1')
    await pool.query(`insert into registros (usuario_id, colecao, id, dados, atualizado_em) values ($1, 'habitos', 'h1', $2, 1)`, [
      usuarioId,
      habito({ lembrete: { ativo: true, modo: 'fixo', horario: '10:00' } }),
    ])
    const chamadas: string[] = []
    const enviar = async (_u: string, c: { titulo: string }) => (chamadas.push(c.titulo), 1)
    assert.equal(await verificarLembretes(AGORA, enviar), 1)
    assert.deepEqual(chamadas, ['📖 Ler'])
    assert.equal(await verificarLembretes(AGORA + 60_000, enviar), 0) // mesmo dia: não repete
  })

  test('não avisa o hábito concluído hoje', async () => {
    await pool.query(`insert into registros (usuario_id, colecao, id, dados, atualizado_em) values ($1, 'habitos', 'h2', $2, 1)`, [
      usuarioId,
      habito({ nome: 'Cama', lembrete: { ativo: true, modo: 'fixo', horario: '10:00' } }),
    ])
    await pool.query(`insert into registros (usuario_id, colecao, id, dados, atualizado_em) values ($1, 'registrosHabito', 'h2_2026-11-24', $2, 1)`, [
      usuarioId,
      { habitoId: 'h2', data: '2026-11-24', valor: 1, concluido: true, concluidoEm: emSP(24, 8) },
    ])
    const chamadas: string[] = []
    await verificarLembretes(AGORA, async (_u, c) => (chamadas.push(c.titulo), 1))
    assert.deepEqual(chamadas, [])
  })

  test('envio real: criptografa, entrega e apaga inscrição expirada (410)', async () => {
    await inscrever('push/expirada')
    recebidos.length = 0
    const resultado = await enviarParaUsuario(usuarioId, { titulo: 'MOTUS', corpo: 'teste' })
    assert.deepEqual(resultado, { enviadas: 1, falhas: 0 })
    assert.deepEqual(recebidos.map((r) => r.status).sort(), [201, 410])
    const restantes = await pool.query('select endpoint from push_inscricoes where usuario_id = $1', [usuarioId])
    assert.deepEqual(
      restantes.rows.map((r) => r.endpoint),
      [`https://localhost:${porta}/push/aparelho-1`],
    )
  })
})
