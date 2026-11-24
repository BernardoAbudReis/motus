import { describe, expect, test } from 'vitest'
import type { Habito } from '../db'
import {
  agendadoNoDia,
  contarPeriodo,
  descreverFrequencia,
  descreverValor,
  diasSemFazer,
  inicioDaSemana,
  melhorSequencia,
  sequenciaAtual,
} from './logica'

// 2026-11-24 é uma terça-feira.
const HOJE = '2026-11-24'

function habito(campos: Partial<Habito> = {}): Habito {
  return {
    id: 'h',
    nome: 'Teste',
    cor: 'menta',
    icone: '✅',
    frequencia: { tipo: 'diaria' },
    meta: { tipo: 'check' },
    arquivado: false,
    ordem: 0,
    criadoEm: new Date(2026, 9, 1).getTime(), // 01/10/2026
    updatedAt: 0,
    deletedAt: null,
    dirty: 0,
    ...campos,
  }
}

const feitos = (...datas: string[]) => new Map(datas.map((d) => [d, 1]))

describe('agenda', () => {
  test('hábito de terça e quinta só é agendado nesses dias', () => {
    const boxe = habito({ frequencia: { tipo: 'dias', dias: [2, 4] } })
    expect(agendadoNoDia(boxe, '2026-11-24')).toBe(true) // terça
    expect(agendadoNoDia(boxe, '2026-11-23')).toBe(false) // segunda
    expect(agendadoNoDia(boxe, '2026-11-26')).toBe(true) // quinta
  })

  test('não é agendado antes de ser criado', () => {
    expect(agendadoNoDia(habito(), '2026-09-30')).toBe(false)
  })
})

describe('sequência', () => {
  test('conta dias seguidos e não quebra se hoje ainda não foi feito', () => {
    const h = habito()
    expect(sequenciaAtual(h, feitos('2026-11-21', '2026-11-22', '2026-11-23'), HOJE)).toBe(3)
    expect(sequenciaAtual(h, feitos('2026-11-22', '2026-11-23', HOJE), HOJE)).toBe(3)
  })

  test('um dia agendado sem registro quebra a sequência', () => {
    expect(sequenciaAtual(habito(), feitos('2026-11-20', '2026-11-21', '2026-11-23'), HOJE)).toBe(1)
  })

  test('dias fora da frequência não quebram a sequência', () => {
    const boxe = habito({ frequencia: { tipo: 'dias', dias: [2, 4] } })
    // Terças e quintas seguidas, pulando os outros dias.
    expect(sequenciaAtual(boxe, feitos('2026-11-12', '2026-11-17', '2026-11-19', HOJE), HOJE)).toBe(4)
  })

  test('meta quantitativa só conta quando atinge o alvo', () => {
    const estudar = habito({ meta: { tipo: 'tempo', alvoMin: 120 } })
    const valores = new Map([
      ['2026-11-22', 120],
      ['2026-11-23', 90],
    ])
    expect(sequenciaAtual(estudar, valores, HOJE)).toBe(0)
  })

  test('dias lançados antes da criação entram na sequência e nos percentuais', () => {
    const criadoHoje = habito({ criadoEm: new Date(2026, 10, 24, 9).getTime() })
    const v = feitos('2026-11-22', '2026-11-23')
    expect(sequenciaAtual(criadoHoje, v, HOJE)).toBe(2)
    expect(contarPeriodo([criadoHoje], new Map([['h', v]]), '2026-11-20', HOJE)).toEqual({ feitos: 2, total: 3 })
  })

  test('dias sem fazer conta só os agendados, a partir de ontem', () => {
    const boxe = habito({ frequencia: { tipo: 'dias', dias: [2, 4] } })
    // Último boxe em 12/11 (quinta). Depois: ter 17, qui 19 sem fazer; hoje (ter 24) não conta.
    expect(diasSemFazer(boxe, feitos('2026-11-12'), HOJE)).toBe(2)
    expect(diasSemFazer(habito(), feitos('2026-11-23'), HOJE)).toBe(0)
  })

  test('melhor sequência guarda o maior trecho', () => {
    const v = feitos('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-10', '2026-11-11')
    expect(melhorSequencia(habito(), v, HOJE)).toBe(4)
  })
})

describe('percentuais', () => {
  test('conta só os dias agendados', () => {
    const boxe = habito({ id: 'boxe', frequencia: { tipo: 'dias', dias: [2, 4] } })
    const cama = habito({ id: 'cama' })
    const valores = new Map([
      ['boxe', feitos('2026-11-24')],
      ['cama', feitos('2026-11-23', '2026-11-24')],
    ])
    // Semana de 23/11 (segunda) até hoje: boxe agendado 1 dia, cama 2 dias.
    expect(contarPeriodo([boxe, cama], valores, inicioDaSemana(HOJE), HOJE)).toEqual({ feitos: 3, total: 3 })
  })

  test('a semana começa na segunda', () => {
    expect(inicioDaSemana('2026-11-24')).toBe('2026-11-23')
    expect(inicioDaSemana('2026-11-29')).toBe('2026-11-23') // domingo
  })
})

describe('textos', () => {
  test('frequência e valores', () => {
    expect(descreverFrequencia({ tipo: 'dias', dias: [4, 2] })).toBe('Ter., qui.')
    expect(descreverFrequencia({ tipo: 'diaria' })).toBe('Todo dia')
    expect(descreverValor({ tipo: 'tempo', alvoMin: 120 }, 90)).toBe('1,5/2 h')
    expect(descreverValor({ tipo: 'tempo', alvoMin: 30 }, 0)).toBe('0/30 min')
    expect(descreverValor({ tipo: 'quantidade', alvo: 8, unidade: 'copos' }, 3)).toBe('3/8 copos')
  })
})
