import { describe, expect, test } from 'vitest'
import type { Habito, SessaoTreino } from '../db'
import { diasPerfeitos, exerciciosComHistorico, porHabito, porSemana, resumoTreinos, serieDiaria, treinosPorSemana } from './logica'

// 2026-11-24 é uma terça-feira.
const HOJE = '2026-11-24'
const base = { updatedAt: 0, deletedAt: null, dirty: 0 as const }

function habito(id: string, campos: Partial<Habito> = {}): Habito {
  return {
    ...base,
    id,
    nome: id,
    cor: 'menta',
    icone: '✅',
    frequencia: { tipo: 'diaria' },
    meta: { tipo: 'check' },
    arquivado: false,
    ordem: 0,
    criadoEm: new Date(2026, 9, 1).getTime(),
    ...campos,
  }
}

const feitos = (...datas: string[]) => new Map(datas.map((d) => [d, 1]))

function sessao(id: string, data: Date, peso = 20, reps = 10, finalizada = true): SessaoTreino {
  return {
    ...base,
    id,
    fichaId: 'f',
    fichaNome: 'Treino A',
    iniciadaEm: data.getTime(),
    finalizadaEm: finalizada ? data.getTime() + 3600_000 : null,
    duracaoSeg: 3600,
    observacoes: '',
    exercicios: [
      {
        exercicioId: 'supino',
        nome: 'Supino reto',
        grupoMuscular: 'Peito',
        equipamento: 'Barra',
        repeticoesPlanejadas: 10,
        descansoSeg: 60,
        observacoes: '',
        series: [{ peso, repeticoes: reps, concluida: true }],
      },
    ],
  }
}

describe('hábitos', () => {
  const cama = habito('cama')
  const boxe = habito('boxe', { frequencia: { tipo: 'dias', dias: [2, 4] } })
  const valores = new Map([
    ['cama', feitos('2026-11-23', '2026-11-24')],
    ['boxe', feitos('2026-11-24')],
  ])

  test('série diária conta só o que estava agendado', () => {
    const serie = serieDiaria([cama, boxe], valores, '2026-11-23', HOJE)
    expect(serie).toEqual([
      { data: '2026-11-23', feitos: 1, total: 1 }, // segunda: só a cama
      { data: '2026-11-24', feitos: 2, total: 2 }, // terça: cama e boxe
    ])
    expect(diasPerfeitos(serie)).toBe(2)
  })

  test('agrupa por semana começando na segunda', () => {
    const serie = serieDiaria([cama], valores, '2026-11-20', HOJE)
    expect(porSemana(serie).map((s) => [s.data, s.feitos, s.total])).toEqual([
      ['2026-11-16', 0, 3], // sex, sáb, dom
      ['2026-11-23', 2, 2], // seg, ter
    ])
  })

  test('por hábito: consistência e sequência, do mais consistente para o menos', () => {
    const linhas = porHabito([boxe, cama], valores, '2026-11-23', HOJE)
    expect(linhas.map((l) => [l.habito.id, l.consistencia, l.sequencia])).toEqual([
      ['cama', 100, 2], // mesma consistência: desempata pela maior sequência
      ['boxe', 100, 1],
    ])
  })
})

describe('academia', () => {
  const sessoes = [
    sessao('a', new Date(2026, 10, 24, 18)), // semana atual
    sessao('b', new Date(2026, 10, 23, 18), 22, 8), // semana atual
    sessao('c', new Date(2026, 10, 17, 18)), // semana anterior
    sessao('d', new Date(2026, 10, 24, 20), 30, 5, false), // em andamento: não conta
  ]

  test('treinos por semana, terminando na semana atual', () => {
    expect(treinosPorSemana(sessoes, 3, HOJE)).toEqual([
      { inicio: '2026-11-09', quantidade: 0 },
      { inicio: '2026-11-16', quantidade: 1 },
      { inicio: '2026-11-23', quantidade: 2 },
    ])
  })

  test('resumo do período ignora treino em andamento', () => {
    expect(resumoTreinos(sessoes, '2026-11-23', HOJE)).toEqual({ quantidade: 2, volume: 200 + 176, series: 2, duracaoMediaSeg: 3600 })
  })

  test('exercícios com histórico', () => {
    expect(exerciciosComHistorico(sessoes)).toEqual([{ exercicioId: 'supino', nome: 'Supino reto', treinos: 3 }])
  })
})
