import { COLECOES, db, gravarMeta, lerMeta, tabela, type Colecao, type Sincronizavel } from './db'
import { ErroApi, lerToken, requisicao } from './api'

/**
 * Sincronização com o servidor, em duas etapas:
 *
 * 1. Envio: manda os registros com dirty = 1. O servidor faz upsert pelo id e
 *    só aceita se o updatedAt for mais novo, então reenviar (queda de conexão
 *    no meio) não duplica nem sobrescreve dado mais novo.
 * 2. Recebimento: pede as mudanças desde o último cursor. Uma mudança do
 *    servidor só substitui a local se a local não tiver alteração pendente
 *    mais nova (vence a alteração mais recente).
 */

interface Mudanca {
  colecao: Colecao
  id: string
  updatedAt: number
  deletedAt: number | null
  dados: Record<string, unknown>
}

export type EstadoSync =
  | { tipo: 'desconectado' } // sem login: dados só no aparelho
  | { tipo: 'offline' }
  | { tipo: 'sincronizando' }
  | { tipo: 'ok'; em: number }
  | { tipo: 'erro'; mensagem: string }

const LOTE = 200
let rodando = false
let pendente = false
let timer: ReturnType<typeof setTimeout> | undefined
let estado: EstadoSync = { tipo: 'desconectado' }
const ouvintes = new Set<(e: EstadoSync) => void>()

function definirEstado(novo: EstadoSync) {
  estado = novo
  ouvintes.forEach((f) => f(novo))
}

export function ouvirEstadoSync(f: (e: EstadoSync) => void) {
  ouvintes.add(f)
  f(estado)
  return () => {
    ouvintes.delete(f)
  }
}

/** Junta várias gravações seguidas numa sincronização só. */
export function agendarSincronizacao(atrasoMs = 1500) {
  clearTimeout(timer)
  timer = setTimeout(() => void sincronizar(), atrasoMs)
}

function separar(registro: Sincronizavel): Mudanca['dados'] {
  const { id: _id, updatedAt: _u, deletedAt: _d, dirty: _dirty, ...dados } = registro
  return dados
}

async function enviar() {
  for (const colecao of COLECOES) {
    for (;;) {
      const sujos = await tabela(colecao).where('dirty').equals(1).limit(LOTE).toArray()
      if (sujos.length === 0) break
      const mudancas: Mudanca[] = sujos.map((r) => ({
        colecao,
        id: r.id,
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt,
        dados: separar(r),
      }))
      await requisicao('/sync/push', { method: 'POST', body: JSON.stringify({ mudancas }) })
      // Só limpa a marca se o registro não mudou enquanto era enviado.
      await db.transaction('rw', tabela(colecao), async () => {
        for (const m of mudancas) {
          const atual = await tabela(colecao).get(m.id)
          if (atual && atual.updatedAt === m.updatedAt) {
            await tabela(colecao).update(m.id, { dirty: 0 })
          }
        }
      })
      if (sujos.length < LOTE) break
    }
  }
}

async function receber() {
  let cursor = (await lerMeta<number>('cursor')) ?? 0
  for (;;) {
    const resposta = await requisicao<{ mudancas: Mudanca[]; cursor: number; temMais: boolean }>(
      `/sync/pull?desde=${cursor}`,
    )
    await db.transaction('rw', [...COLECOES.map(tabela), db.meta], async () => {
      for (const m of resposta.mudancas) {
        if (!COLECOES.includes(m.colecao)) continue
        const t = tabela(m.colecao)
        const local = await t.get(m.id)
        if (local && local.dirty === 1 && local.updatedAt >= m.updatedAt) continue
        await t.put({ ...m.dados, id: m.id, updatedAt: m.updatedAt, deletedAt: m.deletedAt, dirty: 0 })
      }
      await gravarMeta('cursor', resposta.cursor)
    })
    cursor = resposta.cursor
    if (!resposta.temMais) break
  }
}

export async function sincronizar() {
  if (!(await lerToken())) return definirEstado({ tipo: 'desconectado' })
  if (!navigator.onLine) return definirEstado({ tipo: 'offline' })
  if (rodando) {
    pendente = true
    return
  }
  rodando = true
  definirEstado({ tipo: 'sincronizando' })
  try {
    await enviar()
    await receber()
    definirEstado({ tipo: 'ok', em: Date.now() })
  } catch (e) {
    if (e instanceof ErroApi && e.status === 401) {
      await gravarMeta('token', null)
      definirEstado({ tipo: 'erro', mensagem: 'Sessão expirada. Entre novamente.' })
    } else if (!navigator.onLine || e instanceof TypeError) {
      definirEstado({ tipo: 'offline' }) // falha de rede: tenta de novo quando voltar
    } else {
      definirEstado({ tipo: 'erro', mensagem: (e as Error).message })
    }
  } finally {
    rodando = false
    if (pendente) {
      pendente = false
      agendarSincronizacao(500)
    }
  }
}

/** Liga a sincronização automática: ao abrir, ao voltar a conexão, ao voltar para o app e a cada 5 min. */
export function iniciarSincronizacaoAutomatica() {
  void sincronizar()
  window.addEventListener('online', () => void sincronizar())
  window.addEventListener('offline', () => definirEstado({ tipo: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar()
  })
  setInterval(() => void sincronizar(), 5 * 60 * 1000)
}
