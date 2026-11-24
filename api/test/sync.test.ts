import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { criarApp } from '../src/app.js'
import { pool } from '../src/banco.js'
import { migrar } from '../src/migrar.js'

let base = ''
let fechar: () => void

before(async () => {
  await migrar()
  const servidor = criarApp().listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
})

after(async () => {
  fechar()
  await pool.query("delete from usuarios where email like '%@sync.teste.local'")
  await pool.end()
})

async function chamar(caminho: string, token?: string, corpo?: unknown) {
  const r = await fetch(base + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return { status: r.status, corpo: await r.json() }
}

async function novoUsuario() {
  const email = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@sync.teste.local`
  const r = await chamar('/auth/cadastro', undefined, { email, senha: 'senha-de-teste-123' })
  assert.equal(r.status, 201)
  return r.corpo.token as string
}

const habito = (updatedAt: number, nome: string, deletedAt: number | null = null) => ({
  colecao: 'habitos',
  id: 'habito-1',
  updatedAt,
  deletedAt,
  dados: {
    nome,
    cor: 'menta',
    icone: '📖',
    frequencia: { tipo: 'diaria' },
    meta: { tipo: 'check' },
    arquivado: false,
    ordem: 1,
    criadoEm: 1,
  },
})

test('sem token, a sincronização é recusada', async () => {
  assert.equal((await chamar('/sync/pull')).status, 401)
})

test('reenviar o mesmo registro não duplica', async () => {
  const token = await novoUsuario()
  const t = Date.now() - 10_000
  await chamar('/sync/push', token, { mudancas: [habito(t, 'Ler')] })
  await chamar('/sync/push', token, { mudancas: [habito(t, 'Ler')] })
  const { corpo } = await chamar('/sync/pull?desde=0', token)
  assert.equal(corpo.mudancas.length, 1)
  assert.equal(corpo.mudancas[0].dados.nome, 'Ler')
})

test('alteração antiga que chega atrasada não sobrescreve a nova', async () => {
  const token = await novoUsuario()
  const t = Date.now() - 10_000
  await chamar('/sync/push', token, { mudancas: [habito(t + 2000, 'Ler 30 min')] })
  await chamar('/sync/push', token, { mudancas: [habito(t, 'Ler')] })
  const { corpo } = await chamar('/sync/pull?desde=0', token)
  assert.equal(corpo.mudancas[0].dados.nome, 'Ler 30 min')
})

test('a exclusão é propagada e o cursor só traz o que mudou', async () => {
  const token = await novoUsuario()
  const t = Date.now() - 10_000
  await chamar('/sync/push', token, { mudancas: [habito(t, 'Ler')] })
  const primeiro = await chamar('/sync/pull?desde=0', token)
  const semNovidade = await chamar(`/sync/pull?desde=${primeiro.corpo.cursor}`, token)
  assert.equal(semNovidade.corpo.mudancas.length, 0)

  await chamar('/sync/push', token, { mudancas: [habito(t + 1000, 'Ler', t + 1000)] })
  const depois = await chamar(`/sync/pull?desde=${primeiro.corpo.cursor}`, token)
  assert.equal(depois.corpo.mudancas.length, 1)
  assert.equal(depois.corpo.mudancas[0].deletedAt, t + 1000)
})

test('cada usuário só vê os próprios dados', async () => {
  const a = await novoUsuario()
  const b = await novoUsuario()
  await chamar('/sync/push', a, { mudancas: [habito(Date.now() - 1000, 'Segredo de A')] })
  const { corpo } = await chamar('/sync/pull?desde=0', b)
  assert.equal(corpo.mudancas.length, 0)
})

test('relógio adiantado no aparelho é limitado ao horário do servidor', async () => {
  const token = await novoUsuario()
  const futuro = Date.now() + 365 * 24 * 3600 * 1000
  await chamar('/sync/push', token, { mudancas: [habito(futuro, 'Do futuro')] })
  const { corpo } = await chamar('/sync/pull?desde=0', token)
  assert.ok(corpo.mudancas[0].updatedAt <= Date.now())
})

test('coleção desconhecida é recusada', async () => {
  const token = await novoUsuario()
  const r = await chamar('/sync/push', token, { mudancas: [{ ...habito(1, 'x'), colecao: 'outra' }] })
  assert.equal(r.status, 400)
})

test('estudos: matéria, conteúdo, atividade e sessão sincronizam; atividade inválida é rejeitada', async () => {
  const token = await novoUsuario()
  const t = Date.now() - 10_000
  const reg = (colecao: string, id: string, dados: Record<string, unknown>) => ({ colecao, id, updatedAt: t, deletedAt: null, dados })
  const mudancas = [
    reg('setores', 's1', { nome: 'Geral', ordem: 1, arquivado: false }),
    reg('materias', 'm1', { setorId: 's1', nome: 'JavaScript', cor: 'limao', icone: '💻', descricao: '', ordem: 1, arquivada: false }),
    reg('conteudos', 'c1', {
      materiaId: 'm1',
      nome: 'Arrays',
      descricao: '',
      ordem: 1,
      prioridade: 'alta',
      status: 'andamento',
      tempoEstimadoMin: 60,
      concluidoEm: null,
      observacoes: '',
    }),
    reg('atividades', 'a1', {
      conteudoId: 'c1',
      tipo: 'revisao',
      data: '2026-11-25',
      dataOriginal: '2026-11-24',
      ordem: 0,
      estado: 'planejada',
      reagendamentos: [{ de: '2026-11-24', para: '2026-11-25', em: t }],
      feitaEm: null,
    }),
    reg('sessoesEstudo', 'e1', { conteudoId: 'c1', tipo: 'estudo', data: '2026-11-24', minutos: 45, dificuldade: 'media', observacoes: '', atividadeId: null }),
    // Estado que não existe: rejeitado sem travar o resto.
    reg('atividades', 'ruim', { conteudoId: 'c1', tipo: 'estudo', data: '2026-11-25', dataOriginal: '2026-11-25', ordem: 0, estado: 'concluida', reagendamentos: [], feitaEm: null }),
  ]
  const r = await chamar('/sync/push', token, { mudancas })
  assert.equal(r.status, 200)
  const { corpo } = await chamar('/sync/pull?desde=0', token)
  assert.deepEqual(corpo.mudancas.map((m: { colecao: string }) => m.colecao).sort(), ['atividades', 'conteudos', 'materias', 'sessoesEstudo', 'setores'])
})
