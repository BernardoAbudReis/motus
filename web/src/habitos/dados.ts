import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Habito, type RegistroHabito } from '../db'
import { alterar, ativos, excluir, novoId, salvar } from '../repo'
import { concluido, type ValoresPorData } from './logica'

/**
 * Cores dos cards. Tons sóbrios que funcionam como fundo escuro tingido.
 * Sem roxo, azul ou dourado, para não competir com o verde menta da marca.
 */
export const CORES_HABITO = [
  { id: 'menta', nome: 'Menta', hex: '#53E79F' },
  { id: 'verde', nome: 'Verde', hex: '#5DBB63' },
  { id: 'agua', nome: 'Água', hex: '#3CC2AE' },
  { id: 'vermelho', nome: 'Vermelho', hex: '#E5584F' },
  { id: 'laranja', nome: 'Laranja', hex: '#E5864E' },
  { id: 'terra', nome: 'Terra', hex: '#B4876A' },
  { id: 'grafite', nome: 'Grafite', hex: '#A3A5AA' },
] as const

export function corDoHabito(id: string) {
  return CORES_HABITO.find((c) => c.id === id)?.hex ?? CORES_HABITO[0].hex
}

export const ICONES_HABITO = [
  '📚', '📖', '✍️', '💻', '🧠', '💊', '💧', '🍎', '🥗', '🛏️',
  '😴', '🧘', '🏃', '🚴', '🏋️', '🥊', '⚽', '🏊', '🦷', '🧹',
  '🙏', '🎸', '🎨', '🚭', '💰', '🌱', '☀️', '📵', '🧴', '✅',
]

export type CamposHabito = Pick<Habito, 'nome' | 'cor' | 'icone' | 'frequencia' | 'meta'>

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

/** Um registro por hábito por dia: o id fixo evita duplicar entre aparelhos. */
export function registrar(h: Habito, data: string, valor: number) {
  const v = Math.max(0, Math.round(valor * 100) / 100)
  return salvar<RegistroHabito>('registrosHabito', `${h.id}_${data}`, {
    habitoId: h.id,
    data,
    valor: v,
    concluido: concluido(h, v),
  })
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

export async function criarHabito(campos: CamposHabito) {
  const ultima = await db.habitos.orderBy('ordem').last()
  return salvar<Habito>('habitos', novoId(), {
    ...campos,
    arquivado: false,
    ordem: (ultima?.ordem ?? 0) + 1,
    criadoEm: Date.now(),
  })
}

export function atualizarHabito(id: string, campos: Partial<CamposHabito>) {
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
