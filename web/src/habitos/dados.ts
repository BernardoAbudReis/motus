import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Habito, type RegistroHabito } from '../db'
import { alterar, ativos, dataLocal, excluir, novoId, salvar } from '../repo'
import { corHex as corDoHabito } from '../cores'
import { concluido, type ValoresPorData } from './logica'

/** Cores ficam em ../cores.ts (compartilhadas com as matérias de Estudos). */
export { corHex as corDoHabito } from '../cores'

export const ICONES_HABITO = [
  '📚', '📖', '✍️', '💻', '🧠', '💊', '💧', '🍎', '🥗', '🛏️',
  '😴', '🧘', '🏃', '🚴', '🏋️', '🥊', '⚽', '🏊', '🦷', '🧹',
  '🙏', '🎸', '🎨', '🚭', '💰', '🌱', '☀️', '📵', '🧴', '✅',
]

export type CamposHabito = Pick<Habito, 'nome' | 'cor' | 'icone' | 'frequencia' | 'meta'> & { lembrete?: Habito['lembrete'] }

export function useHabitos(): Habito[] | undefined {
  return useLiveQuery(async () => ativos(await db.habitos.orderBy('ordem').toArray()), [])
}

/** Todos os registros, agrupados por hábito e por data. */
export function useValores(): Map<string, ValoresPorData> {
  const registros = useLiveQuery(() => db.registrosHabito.toArray(), [])
  return useMemo(() => {
    const mapa = new Map<string, ValoresPorData>()
    for (const r of registros ?? []) {
      if (r.deletedAt !== null) continue
      if (!mapa.has(r.habitoId)) mapa.set(r.habitoId, new Map())
      mapa.get(r.habitoId)!.set(r.data, r.valor)
    }
    return mapa
  }, [registros])
}

/** Disparado quando um hábito passa de "não concluído" para "concluído" (confetes, por exemplo). */
export const EVENTO_CONCLUIDO = 'motus:habito-concluido'
export interface DetalheConcluido {
  habitoId: string
  cor: string
}

/**
 * Um registro por hábito por dia: o id fixo evita duplicar entre aparelhos.
 * Guarda a hora da conclusão quando ela acontece no próprio dia; é com ela que
 * o lembrete automático aprende o horário em que o hábito costuma ser feito.
 */
export async function registrar(h: Habito, data: string, valor: number) {
  const v = Math.max(0, Math.round(valor * 100) / 100)
  const id = `${h.id}_${data}`
  const anterior = await db.registrosHabito.get(id)
  const jaEstava = !!anterior && anterior.deletedAt === null && anterior.concluido
  const agora = concluido(h, v)
  const concluidoEm = !agora ? null : jaEstava ? (anterior.concluidoEm ?? null) : data === dataLocal() ? Date.now() : null

  const registro = await salvar<RegistroHabito>('registrosHabito', id, {
    habitoId: h.id,
    data,
    valor: v,
    concluido: agora,
    concluidoEm,
  })
  if (agora && !jaEstava) {
    // Fora da transação do Dexie: quem ouve pode mexer na tela à vontade.
    setTimeout(() =>
      window.dispatchEvent(new CustomEvent<DetalheConcluido>(EVENTO_CONCLUIDO, { detail: { habitoId: h.id, cor: corDoHabito(h.cor) } })),
    )
  }
  return registro
}

/** Instantes (ms) em que o hábito foi concluído, para calcular o horário médio. */
export function useConclusoes(habitoId: string | undefined): number[] {
  return (
    useLiveQuery(
      async () =>
        habitoId
          ? (await db.registrosHabito.where('habitoId').equals(habitoId).toArray())
              .filter((r) => r.deletedAt === null && r.concluido && typeof r.concluidoEm === 'number')
              .map((r) => r.concluidoEm as number)
          : [],
      [habitoId],
    ) ?? []
  )
}

/**
 * Altera o valor do dia a partir do que está gravado (não do que está na
 * tela), dentro de uma transação: toques rápidos seguidos não se perdem.
 */
function aplicar(h: Habito, data: string, calcular: (atual: number) => number) {
  return db.transaction('rw', db.registrosHabito, async () => {
    const r = await db.registrosHabito.get(`${h.id}_${data}`)
    const atual = r && r.deletedAt === null ? r.valor : 0
    await registrar(h, data, calcular(atual))
  })
}

export function somar(h: Habito, data: string, delta: number) {
  return aplicar(h, data, (atual) => atual + delta)
}

/** Toque no botão do card: marca/desmarca, ou soma 1 na meta de quantidade. */
export function acaoRapida(h: Habito, data: string) {
  if (h.meta.tipo === 'check') return aplicar(h, data, (atual) => (atual >= 1 ? 0 : 1))
  return somar(h, data, 1)
}

export async function criarHabito(campos: CamposHabito, criadoEm = Date.now()) {
  const ultima = await db.habitos.orderBy('ordem').last()
  return salvar<Habito>('habitos', novoId(), {
    ...campos,
    arquivado: false,
    ordem: (ultima?.ordem ?? 0) + 1,
    criadoEm,
  })
}

export function atualizarHabito(id: string, campos: Partial<CamposHabito & { criadoEm: number }>) {
  return alterar<Habito>('habitos', id, campos)
}

export function arquivarHabito(id: string, arquivado: boolean) {
  return alterar<Habito>('habitos', id, { arquivado })
}

/** Exclui o hábito e o histórico dele (em todos os aparelhos, pela sincronização). */
export async function excluirHabito(id: string) {
  const registros = await db.registrosHabito.where('habitoId').equals(id).toArray()
  for (const r of registros) await excluir('registrosHabito', r.id)
  await excluir('habitos', id)
}

export async function criarExemplos() {
  const exemplos: CamposHabito[] = [
    { nome: 'Estudar', icone: '📚', cor: 'verde', frequencia: { tipo: 'diaria' }, meta: { tipo: 'tempo', alvoMin: 120 } },
    { nome: 'Ler um livro', icone: '📖', cor: 'terra', frequencia: { tipo: 'diaria' }, meta: { tipo: 'tempo', alvoMin: 30 } },
    { nome: 'Tomar creatina', icone: '💊', cor: 'agua', frequencia: { tipo: 'diaria' }, meta: { tipo: 'check' } },
    { nome: 'Boxe', icone: '🥊', cor: 'vermelho', frequencia: { tipo: 'dias', dias: [2, 4] }, meta: { tipo: 'check' } },
    { nome: 'Fazer a cama', icone: '🛏️', cor: 'grafite', frequencia: { tipo: 'diaria' }, meta: { tipo: 'check' } },
  ]
  for (const e of exemplos) await criarHabito(e)
}
