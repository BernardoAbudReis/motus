import type { Habito, Lembrete } from '../db'

/**
 * Horário do lembrete de um hábito. Mantenha em sincronia com
 * api/src/lembretes.ts, que faz a mesma conta no servidor (no fuso do aparelho).
 */

export const MINIMO_CONCLUSOES = 3
export const MAXIMO_CONCLUSOES = 20
export const LEMBRETE_PADRAO: Lembrete = { ativo: true, modo: 'auto', horario: '20:00' }

export function lembreteDe(h: Pick<Habito, 'lembrete'>): Lembrete {
  return { ...LEMBRETE_PADRAO, ...h.lembrete }
}

export function minutosDoDia(ms: number) {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

export function horarioParaMinutos(horario: string) {
  const [h, m] = horario.split(':').map(Number)
  return ((h || 0) * 60 + (m || 0)) % 1440
}

export function minutosParaHorario(minutos: number) {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Média de horários no relógio (circular): 23:50 e 00:10 dão 00:00, não 12:00.
 * Cada horário vira um ponto no círculo de 24 h e a média é o ângulo do vetor soma.
 */
export function mediaCircular(minutos: number[]): number | null {
  if (minutos.length === 0) return null
  let x = 0
  let y = 0
  for (const m of minutos) {
    const angulo = (m / 1440) * 2 * Math.PI
    x += Math.cos(angulo)
    y += Math.sin(angulo)
  }
  if (Math.hypot(x, y) < 1e-9) return null // horários espalhados por igual: sem média que faça sentido
  let angulo = Math.atan2(y, x)
  if (angulo < 0) angulo += 2 * Math.PI
  return Math.round((angulo / (2 * Math.PI)) * 1440) % 1440
}

export interface HorarioLembrete {
  minutos: number
  origem: 'media' | 'fixo' | 'padrao'
  /** Quantas conclusões entraram na média. */
  amostras: number
}

/** Horário em que o lembrete deve tocar, a partir dos instantes de conclusão (ms) do hábito. */
export function horarioDoLembrete(
  h: Pick<Habito, 'lembrete'>,
  conclusoes: number[],
  paraMinutos: (ms: number) => number = minutosDoDia,
): HorarioLembrete {
  const l = lembreteDe(h)
  const ultimas = [...conclusoes].sort((a, b) => b - a).slice(0, MAXIMO_CONCLUSOES)
  if (l.modo === 'fixo') return { minutos: horarioParaMinutos(l.horario), origem: 'fixo', amostras: ultimas.length }
  const media = ultimas.length >= MINIMO_CONCLUSOES ? mediaCircular(ultimas.map(paraMinutos)) : null
  if (media !== null) return { minutos: media, origem: 'media', amostras: ultimas.length }
  return { minutos: horarioParaMinutos(l.horario), origem: 'padrao', amostras: ultimas.length }
}
