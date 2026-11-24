import type { Frequencia, Habito, Meta } from '../db'
import { dataLocal } from '../repo'

/** Valores registrados de um hábito, por data (AAAA-MM-DD). */
export type ValoresPorData = Map<string, number>

export const DIAS_CURTOS = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.']

export function lerData(d: string) {
  const [a, m, dia] = d.split('-').map(Number)
  return new Date(a, m - 1, dia)
}

export function somarDias(d: string, n: number) {
  const x = lerData(d)
  x.setDate(x.getDate() + n)
  return dataLocal(x)
}

export function diaDaSemana(d: string) {
  return lerData(d).getDay()
}

export function inicioDoHabito(h: Habito) {
  return dataLocal(new Date(h.criadoEm))
}

/** A frequência prevê o hábito nesse dia da semana? (Sem olhar a data de criação.) */
export function previstoPelaFrequencia(h: Habito, data: string) {
  return h.frequencia.tipo === 'diaria' || h.frequencia.dias.includes(diaDaSemana(data))
}

/**
 * A partir de quando o hábito conta nas estatísticas: a data de criação, ou o
 * primeiro registro, se o usuário lançou dias anteriores à criação.
 */
export function inicioEfetivo(h: Habito, valores?: ValoresPorData) {
  let inicio = inicioDoHabito(h)
  if (valores) for (const [d, v] of valores) if (v > 0 && d < inicio) inicio = d
  return inicio
}

/** O hábito deveria ser feito nesse dia? Respeita a frequência e o início efetivo. */
export function agendadoNoDia(h: Habito, data: string, valores?: ValoresPorData) {
  return data >= inicioEfetivo(h, valores) && previstoPelaFrequencia(h, data)
}

export function alvo(meta: Meta) {
  if (meta.tipo === 'quantidade') return Math.max(1, meta.alvo)
  if (meta.tipo === 'tempo') return Math.max(1, meta.alvoMin)
  return 1
}

export function concluido(h: Habito, valor: number) {
  return valor >= alvo(h.meta)
}

export function progresso(h: Habito, valor: number) {
  return Math.min(1, Math.max(0, valor / alvo(h.meta)))
}

/**
 * Sequência atual: dias agendados seguidos com o hábito concluído, contando
 * para trás a partir de `hoje`. Dias não agendados (ex.: boxe numa segunda)
 * não quebram a sequência. Hoje ainda sem registro também não quebra, porque
 * o dia não acabou.
 */
export function sequenciaAtual(h: Habito, valores: ValoresPorData, hoje: string) {
  const inicio = inicioEfetivo(h, valores)
  let n = 0
  for (let d = hoje; d >= inicio; d = somarDias(d, -1)) {
    if (!previstoPelaFrequencia(h, d)) continue
    if (concluido(h, valores.get(d) ?? 0)) n++
    else if (d !== hoje) break
  }
  return n
}

/**
 * Dias agendados seguidos sem fazer, contando a partir de ontem (o dia de hoje
 * ainda não acabou). Mostrado como "−N" no card quando não há sequência.
 */
export function diasSemFazer(h: Habito, valores: ValoresPorData, hoje: string) {
  const inicio = inicioEfetivo(h, valores)
  let n = 0
  for (let d = somarDias(hoje, -1); d >= inicio; d = somarDias(d, -1)) {
    if (!previstoPelaFrequencia(h, d)) continue
    if (concluido(h, valores.get(d) ?? 0)) break
    n++
  }
  return n
}

export function melhorSequencia(h: Habito, valores: ValoresPorData, hoje: string) {
  let melhor = 0
  let atual = 0
  for (let d = inicioEfetivo(h, valores); d <= hoje; d = somarDias(d, 1)) {
    if (!previstoPelaFrequencia(h, d)) continue
    if (concluido(h, valores.get(d) ?? 0)) melhor = Math.max(melhor, ++atual)
    else if (d !== hoje) atual = 0
  }
  return melhor
}

export interface Contagem {
  feitos: number
  total: number
}

/** Quantos dias agendados foram concluídos no intervalo [de, ate]. */
export function contarPeriodo(
  habitos: Habito[],
  valoresPorHabito: Map<string, ValoresPorData>,
  de: string,
  ate: string,
): Contagem {
  let feitos = 0
  let total = 0
  for (const h of habitos) {
    const valores = valoresPorHabito.get(h.id)
    const inicio = inicioEfetivo(h, valores)
    for (let d = de < inicio ? inicio : de; d <= ate; d = somarDias(d, 1)) {
      if (!previstoPelaFrequencia(h, d)) continue
      total++
      if (concluido(h, valores?.get(d) ?? 0)) feitos++
    }
  }
  return { feitos, total }
}

export function percentual({ feitos, total }: Contagem) {
  return total === 0 ? 0 : Math.round((feitos / total) * 100)
}

/** Segunda-feira da semana de `d`. */
export function inicioDaSemana(d: string) {
  const dia = diaDaSemana(d)
  return somarDias(d, dia === 0 ? -6 : 1 - dia)
}

export function inicioDoMes(d: string) {
  return d.slice(0, 8) + '01'
}

export function fimDoMes(d: string) {
  const x = lerData(d)
  return dataLocal(new Date(x.getFullYear(), x.getMonth() + 1, 0))
}

export function descreverFrequencia(f: Frequencia) {
  if (f.tipo === 'diaria' || f.dias.length === 7) return 'Todo dia'
  if (f.dias.length === 0) return 'Nenhum dia'
  // Ordem de segunda a domingo, como no calendário brasileiro de trabalho.
  const ordem = [1, 2, 3, 4, 5, 6, 0]
  const nomes = ordem.filter((d) => f.dias.includes(d)).map((d) => DIAS_CURTOS[d].toLowerCase())
  const texto = nomes.join(', ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function numero(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** "0/2 h", "10/30 min", "3/8 copos"; vazio para hábitos de marcar. */
export function descreverValor(meta: Meta, valor: number) {
  if (meta.tipo === 'check') return ''
  if (meta.tipo === 'quantidade') return `${numero(valor)}/${numero(meta.alvo)} ${meta.unidade}`.trim()
  if (meta.alvoMin >= 60 && meta.alvoMin % 60 === 0) {
    return `${numero(valor / 60)}/${numero(meta.alvoMin / 60)} h`
  }
  return `${numero(valor)}/${numero(meta.alvoMin)} min`
}

export function descreverMeta(meta: Meta) {
  if (meta.tipo === 'check') return 'Marcar como feito'
  if (meta.tipo === 'quantidade') return `${numero(meta.alvo)} ${meta.unidade}`.trim()
  if (meta.alvoMin >= 60 && meta.alvoMin % 60 === 0) return `${meta.alvoMin / 60} h`
  return `${meta.alvoMin} min`
}
