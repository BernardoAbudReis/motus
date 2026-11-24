import { describe, expect, test } from 'vitest'
import type { Exercicio, Ficha, SessaoTreino } from '../db'
import { criarSessao, evolucao, lerNumero, resumir, ultimoDesempenho } from './logica'

const base = { updatedAt: 0, deletedAt: null, dirty: 0 as const }

const supino: Exercicio = {
  ...base,
  id: 'supino',
  nome: 'Supino reto',
  grupoMuscular: 'Peito',
  equipamento: 'Barra',
  descricao: '',
  imagem: null,
  personalizado: false,
}

const ficha: Ficha = {
  ...base,
  id: 'ficha-a',
  nome: 'Treino A',
  descricao: '',
  gruposMusculares: ['Peito'],
  diasSemana: [1],
  itens: [{ id: 'i1', exercicioId: 'supino', series: 4, repeticoes: 12, peso: 20, descansoSeg: 90, observacoes: '' }],
}

function sessao(id: string, iniciadaEm: number, series: [number, number, boolean][], finalizada = true): SessaoTreino {
  return {
    ...base,
    id,
    fichaId: 'ficha-a',
    fichaNome: 'Treino A',
    iniciadaEm,
    finalizadaEm: finalizada ? iniciadaEm + 3600_000 : null,
    duracaoSeg: 3600,
    observacoes: '',
    exercicios: [
      {
        exercicioId: 'supino',
        nome: 'Supino reto',
        grupoMuscular: 'Peito',
        equipamento: 'Barra',
        repeticoesPlanejadas: 12,
        descansoSeg: 90,
        observacoes: '',
        series: series.map(([peso, repeticoes, concluida]) => ({ peso, repeticoes, concluida })),
      },
    ],
  }
}

describe('criar treino a partir da ficha', () => {
  test('sem histórico, usa o peso e as repetições da ficha', () => {
    const s = criarSessao(ficha, new Map([['supino', supino]]), [], 1000)
    expect(s.fichaNome).toBe('Treino A')
    expect(s.exercicios[0].nome).toBe('Supino reto')
    expect(s.exercicios[0].series).toEqual(Array(4).fill({ peso: 20, repeticoes: 12, concluida: false }))
  })

  test('com histórico, repete o peso de cada série da última vez', () => {
    const anterior = sessao('s1', 1000, [
      [20, 12, true],
      [22, 10, true],
    ])
    const s = criarSessao(ficha, new Map([['supino', supino]]), [anterior], 2000)
    expect(s.exercicios[0].series.map((x) => x.peso)).toEqual([20, 22, 22, 22])
  })

  test('é uma cópia: mudar a ficha depois não altera o treino', () => {
    const s = criarSessao(ficha, new Map([['supino', supino]]), [])
    const fichaEditada = { ...ficha, nome: 'Treino A2', itens: [{ ...ficha.itens[0], series: 2 }] }
    expect(fichaEditada.nome).not.toBe(s.fichaNome)
    expect(s.exercicios[0].series).toHaveLength(4)
  })
})

describe('histórico', () => {
  test('último desempenho ignora treino em andamento e séries não concluídas', () => {
    const feito = sessao('s1', 1000, [
      [20, 12, true],
      [25, 0, false],
    ])
    const andamento = sessao('s2', 2000, [[30, 10, true]], false)
    expect(ultimoDesempenho('supino', [feito, andamento])).toEqual([{ peso: 20, repeticoes: 12, concluida: true }])
  })

  test('evolução traz a maior carga de cada treino, em ordem de data', () => {
    const s1 = sessao('s1', 1000, [
      [20, 12, true],
      [22, 10, true],
    ])
    const s2 = sessao('s2', 2000, [
      [22, 12, true],
      [24, 8, true],
      [26, 5, false],
    ])
    const pontos = evolucao('supino', [s2, s1])
    expect(pontos.map((p) => [p.cargaMax, p.repsNaCargaMax])).toEqual([
      [22, 10],
      [24, 8],
    ])
    expect(pontos[1].volume).toBe(22 * 12 + 24 * 8)
  })

  test('resumo conta só as séries concluídas', () => {
    const r = resumir(sessao('s', 0, [
      [20, 10, true],
      [20, 10, false],
    ]))
    expect(r).toEqual({ seriesFeitas: 1, seriesTotal: 2, exerciciosFeitos: 1, volume: 200 })
  })
})

test('lê números com vírgula', () => {
  expect(lerNumero('22,5')).toBe(22.5)
  expect(lerNumero('')).toBeNull()
  expect(lerNumero('abc')).toBeNull()
})
