import { finalizadas, resumir } from '../academia/logica'
import type { Habito, SessaoTreino } from '../db'
import {
  contarPeriodo,
  inicioDaSemana,
  lerData,
  melhorSequencia,
  percentual,
  sequenciaAtual,
  somarDias,
  type ValoresPorData,
} from '../habitos/logica'
import { dataLocal } from '../repo'

export type Periodo = 7 | 30 | 90

export interface PontoDia {
  data: string
  feitos: number
  total: number
}

/** Concluídos e agendados em cada dia do intervalo [de, ate]. */
export function serieDiaria(habitos: Habito[], valores: Map<string, ValoresPorData>, de: string, ate: string): PontoDia[] {
  const serie: PontoDia[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) serie.push({ data: d, ...contarPeriodo(habitos, valores, d, d) })
  return serie
}

/** Junta a série diária por semana (segunda a domingo). `data` é a segunda-feira. */
export function porSemana(serie: PontoDia[]): PontoDia[] {
  const semanas = new Map<string, PontoDia>()
  for (const p of serie) {
    const chave = inicioDaSemana(p.data)
    const s = semanas.get(chave) ?? { data: chave, feitos: 0, total: 0 }
    s.feitos += p.feitos
    s.total += p.total
    semanas.set(chave, s)
  }
  return [...semanas.values()]
}

export function somar(serie: PontoDia[]) {
  return serie.reduce((t, p) => ({ feitos: t.feitos + p.feitos, total: t.total + p.total }), { feitos: 0, total: 0 })
}

/** Dias em que todos os hábitos agendados foram concluídos. */
export function diasPerfeitos(serie: PontoDia[]) {
  return serie.filter((p) => p.total > 0 && p.feitos === p.total).length
}

export interface LinhaHabito {
  habito: Habito
  feitos: number
  total: number
  consistencia: number
  sequencia: number
  melhor: number
}

export function porHabito(
  habitos: Habito[],
  valores: Map<string, ValoresPorData>,
  de: string,
  hoje: string,
): LinhaHabito[] {
  return habitos
    .map((h) => {
      const v = valores.get(h.id) ?? new Map<string, number>()
      const c = contarPeriodo([h], valores, de, hoje)
      return {
        habito: h,
        ...c,
        consistencia: percentual(c),
        sequencia: sequenciaAtual(h, v, hoje),
        melhor: melhorSequencia(h, v, hoje),
      }
    })
    .sort((a, b) => b.consistencia - a.consistencia || b.sequencia - a.sequencia)
}

export interface Semana {
  inicio: string // segunda-feira, AAAA-MM-DD
  quantidade: number
}

/** Treinos finalizados em cada uma das últimas `semanas` semanas, terminando na semana de `hoje`. */
export function treinosPorSemana(sessoes: SessaoTreino[], semanas: number, hoje: string): Semana[] {
  const atual = inicioDaSemana(hoje)
  const lista: Semana[] = Array.from({ length: semanas }, (_, i) => ({
    inicio: somarDias(atual, -7 * (semanas - 1 - i)),
    quantidade: 0,
  }))
  const indice = new Map(lista.map((s, i) => [s.inicio, i]))
  for (const s of finalizadas(sessoes)) {
    const i = indice.get(inicioDaSemana(dataLocal(new Date(s.iniciadaEm))))
    if (i !== undefined) lista[i].quantidade++
  }
  return lista
}

export interface ResumoTreinos {
  quantidade: number
  volume: number
  series: number
  duracaoMediaSeg: number
}

/** Treinos finalizados com data entre [de, ate] (datas locais, inclusivas). */
export function resumoTreinos(sessoes: SessaoTreino[], de: string, ate: string): ResumoTreinos {
  const inicio = lerData(de).getTime()
  const fim = lerData(somarDias(ate, 1)).getTime()
  const lista = finalizadas(sessoes).filter((s) => s.iniciadaEm >= inicio && s.iniciadaEm < fim)
  let volume = 0
  let series = 0
  for (const s of lista) {
    const r = resumir(s)
    volume += r.volume
    series += r.seriesFeitas
  }
  const duracao = lista.reduce((t, s) => t + s.duracaoSeg, 0)
  return { quantidade: lista.length, volume, series, duracaoMediaSeg: lista.length ? Math.round(duracao / lista.length) : 0 }
}

/** Exercícios que já têm séries concluídas em treinos finalizados, do mais feito ao menos feito. */
export function exerciciosComHistorico(sessoes: SessaoTreino[]) {
  const mapa = new Map<string, { exercicioId: string; nome: string; treinos: number }>()
  for (const s of finalizadas(sessoes)) {
    const vistos = new Set<string>()
    for (const e of s.exercicios) {
      if (vistos.has(e.exercicioId) || !e.series.some((x) => x.concluida)) continue
      vistos.add(e.exercicioId)
      const item = mapa.get(e.exercicioId) ?? { exercicioId: e.exercicioId, nome: e.nome, treinos: 0 }
      item.treinos++
      mapa.set(e.exercicioId, item)
    }
  }
  return [...mapa.values()].sort((a, b) => b.treinos - a.treinos || a.nome.localeCompare(b.nome, 'pt-BR'))
}
