import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { criarApp } from '../src/app.js'
import { gerarBackup } from '../src/backup.js'
import { pool } from '../src/banco.js'
import { migrar } from '../src/migrar.js'
import { restaurarBackup } from '../src/restaurar.js'

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
  await pool.query("delete from usuarios where email like '%@conta.teste.local'")
  await pool.end()
})

async function chamar(metodo: string, caminho: string, token?: string, corpo?: unknown) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return { status: r.status, corpo: await r.json() }
}

let n = 0
async function novaConta() {
  const email = `conta${Date.now()}${n++}@conta.teste.local`
  const r = await chamar('POST', '/auth/cadastro', undefined, { email, senha: 'senha-original-1' })
  assert.equal(r.status, 201)
  return { email, token: r.corpo.token as string, codigo: r.corpo.codigoRecuperacao as string }
}

const habitoValido = (id: string, updatedAt = Date.now() - 1000) => ({
  colecao: 'habitos',
  id,
  updatedAt,
  deletedAt: null,
  dados: { nome: 'Ler', cor: 'menta', icone: '📖', frequencia: { tipo: 'diaria' }, meta: { tipo: 'check' }, arquivado: false, ordem: 1, criadoEm: 1 },
})

describe('recuperação de senha', () => {
  test('o cadastro devolve um código de recuperação legível', async () => {
    const { codigo } = await novaConta()
    assert.match(codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  })

  test('com o código: redefine a senha, troca o código e desconecta os outros aparelhos', async () => {
    const { email, token: tokenAntigo, codigo } = await novaConta()
    const r = await chamar('POST', '/auth/redefinir-senha', undefined, { email, codigo: codigo.toLowerCase().replace(/-/g, ' '), novaSenha: 'senha-nova-123' })
    assert.equal(r.status, 200)
    assert.notEqual(r.corpo.codigoRecuperacao, codigo)
    assert.equal((await chamar('GET', '/sync/pull?desde=0', tokenAntigo)).status, 401) // outro aparelho caiu
    assert.equal((await chamar('GET', '/sync/pull?desde=0', r.corpo.token)).status, 200)
    assert.equal((await chamar('POST', '/auth/login', undefined, { email, senha: 'senha-nova-123' })).status, 200)
    // O código usado não vale de novo.
    const repetido = await chamar('POST', '/auth/redefinir-senha', undefined, { email, codigo, novaSenha: 'outra-senha-123' })
    assert.equal(repetido.status, 401)
  })

  test('código errado é recusado', async () => {
    const { email } = await novaConta()
    const r = await chamar('POST', '/auth/redefinir-senha', undefined, { email, codigo: 'AAAA-BBBB-CCCC-DDDD', novaSenha: 'senha-nova-123' })
    assert.equal(r.status, 401)
  })

  test('gerar novo código exige a senha', async () => {
    const { token } = await novaConta()
    assert.equal((await chamar('POST', '/auth/codigo-recuperacao', token, { senha: 'errada' })).status, 401)
    assert.equal((await chamar('POST', '/auth/codigo-recuperacao', token, { senha: 'senha-original-1' })).status, 200)
  })
})

describe('conta', () => {
  test('trocar a senha mantém este aparelho e desconecta os outros', async () => {
    const { token } = await novaConta()
    const r = await chamar('POST', '/auth/trocar-senha', token, { senhaAtual: 'senha-original-1', novaSenha: 'senha-trocada-1' })
    assert.equal(r.status, 200)
    assert.equal((await chamar('GET', '/sync/pull?desde=0', token)).status, 401)
    assert.equal((await chamar('GET', '/sync/pull?desde=0', r.corpo.token)).status, 200)
  })

  test('excluir a conta apaga os dados e invalida o login', async () => {
    const { email, token } = await novaConta()
    await chamar('POST', '/sync/push', token, { mudancas: [habitoValido('h1')] })
    assert.equal((await chamar('DELETE', '/auth/conta', token, { senha: 'errada' })).status, 401)
    assert.equal((await chamar('DELETE', '/auth/conta', token, { senha: 'senha-original-1' })).status, 200)
    assert.equal((await chamar('GET', '/sync/pull?desde=0', token)).status, 401)
    const { rows } = await pool.query("select count(*)::int as n from usuarios where email = $1", [email])
    assert.equal(rows[0].n, 0)
  })
})

describe('validação na sincronização', () => {
  test('registro fora do formato é descartado sozinho; o resto do lote é gravado', async () => {
    const { token } = await novaConta()
    const invalido = { ...habitoValido('h-ruim'), dados: { nome: 'Sem frequência' } }
    const registroIdErrado = {
      colecao: 'registrosHabito',
      id: 'qualquer',
      updatedAt: Date.now() - 1000,
      deletedAt: null,
      dados: { habitoId: 'h1', data: '2026-11-24', valor: 1, concluido: true },
    }
    const r = await chamar('POST', '/sync/push', token, { mudancas: [habitoValido('h-bom'), invalido, registroIdErrado] })
    assert.equal(r.status, 200)
    assert.deepEqual(
      r.corpo.rejeitados.map((x: { id: string }) => x.id),
      ['h-ruim', 'qualquer'],
    )
    const pull = await chamar('GET', '/sync/pull?desde=0', token)
    assert.deepEqual(
      pull.corpo.mudancas.map((m: { id: string }) => m.id),
      ['h-bom'],
    )
  })
})

describe('backup', () => {
  test('gera, guarda só os 14 mais recentes e restaura o que foi apagado', async () => {
    const { email, token } = await novaConta()
    await chamar('POST', '/sync/push', token, { mudancas: [habitoValido('h-backup')] })
    const pasta = mkdtempSync(join(process.env.TEMP ?? tmpdir(), 'motus-backup-'))

    const r = await gerarBackup(pasta)
    assert.ok(r.usuarios >= 1 && r.registros >= 1)

    // Apaga a conta (e os registros, em cascata) e restaura do backup.
    await pool.query('delete from usuarios where email = $1', [email])
    const restaurado = await restaurarBackup(r.arquivo)
    assert.ok(restaurado.usuarios >= 1)
    const volta = await chamar('POST', '/auth/login', undefined, { email, senha: 'senha-original-1' })
    assert.equal(volta.status, 200)
    const pull = await chamar('GET', '/sync/pull?desde=0', volta.corpo.token)
    assert.deepEqual(
      pull.corpo.mudancas.map((m: { id: string }) => m.id),
      ['h-backup'],
    )

    // Restaurar de novo não duplica nada (só insere o que falta).
    assert.deepEqual(await restaurarBackup(r.arquivo).then((x) => [x.usuarios, x.registros]), [0, 0])

    for (let i = 0; i < 15; i++) await gerarBackup(pasta).catch(() => {})
    assert.ok(readdirSync(pasta).filter((a) => a.endsWith('.json.gz')).length <= 14)
  })
})
