import { describe, expect, test } from 'vitest'
import { horarioDoLembrete, mediaCircular, minutosParaHorario } from './lembrete'

const em = (h: number, m = 0) => new Date(2026, 10, 20, h, m).getTime()

describe('média circular', () => {
  test('horários do mesmo período dão a média comum', () => {
    expect(minutosParaHorario(mediaCircular([7 * 60, 8 * 60])!)).toBe('07:30')
  })

  test('em volta da meia-noite: 23:50 e 00:10 dão 00:00, não 12:00', () => {
    expect(minutosParaHorario(mediaCircular([23 * 60 + 50, 10])!)).toBe('00:00')
  })

  test('sem horários, sem média', () => {
    expect(mediaCircular([])).toBeNull()
  })
})

describe('horário do lembrete', () => {
  test('automático com poucas conclusões usa o horário padrão', () => {
    const r = horarioDoLembrete({ lembrete: { ativo: true, modo: 'auto', horario: '21:00' } }, [em(7), em(8)])
    expect(r).toEqual({ minutos: 21 * 60, origem: 'padrao', amostras: 2 })
  })

  test('automático com 3 ou mais conclusões usa a média', () => {
    const r = horarioDoLembrete({}, [em(7, 10), em(7, 30), em(7, 50)])
    expect(minutosParaHorario(r.minutos)).toBe('07:30')
    expect(r.origem).toBe('media')
  })

  test('usa só as 20 conclusões mais recentes', () => {
    const antigas = Array.from({ length: 30 }, (_, i) => new Date(2026, 8, i + 1, 22).getTime())
    const recentes = Array.from({ length: 20 }, (_, i) => new Date(2026, 10, i + 1, 6).getTime())
    expect(minutosParaHorario(horarioDoLembrete({}, [...antigas, ...recentes]).minutos)).toBe('06:00')
  })

  test('horário fixo ignora a média', () => {
    const r = horarioDoLembrete({ lembrete: { ativo: true, modo: 'fixo', horario: '06:45' } }, [em(7), em(8), em(9)])
    expect(r.origem).toBe('fixo')
    expect(minutosParaHorario(r.minutos)).toBe('06:45')
  })
})
