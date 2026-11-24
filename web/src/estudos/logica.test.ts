import { describe, expect, it } from 'vitest'
import type { Atividade, Conteudo, SessaoEstudo } from '../db'
import {
  atrasadas,
  descreverSemana,
  diasDaSemana,
  doDia,
  formatarMinutos,
  progressoDaMateria,
  reagendar,
  resumirSemana,
  revisoesDoConteudo,
  separarRevisoes,
  statusAposEstudo,
} from './logica'

const base = { updatedAt: 0, deletedAt: null, dirty: 0 as const }

function atividade(id: string, campos: Partial<Atividade>): Atividade {
  return {
    ...base,
    id,
    conteudoId: 'c1',
    tipo: 'estudo',
    data: '2026-11-23',
    dataOriginal: campos.data ?? '2026-11-23',
    ordem: 0,
    estado: 'planejada',
    reagendamentos: [],
    feitaEm: null,
    ...campos,
  }
}

function sessao(id: string, campos: Partial<SessaoEstudo>): SessaoEstudo {
  return { ...base, id, conteudoId: 'c1', tipo: 'estudo', data: '2026-11-23', minutos: null, dificuldade: null, observacoes: '', atividadeId: null, ...campos }
}

function conteudo(id: string, campos: Partial<Conteudo>): Conteudo {
  return {
    ...base,
    id,
    materiaId: 'm1',
    nome: id,
    descricao: '',
    ordem: 0,
    prioridade: 'media',
    status: 'pendente',
    tempoEstimadoMin: null,
    concluidoEm: null,
    observacoes: '',
    ...campos,
  }
}

// Semana de segunda 23/11/2026 a domingo 29/11/2026; "hoje" é quarta, 25/11.
const SEGUNDA = '2026-11-23'
const HOJE = '2026-11-25'

describe('planejamento', () => {
  it('a semana vai de segunda a domingo', () => {
    expect(diasDaSemana(SEGUNDA)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
  })

  it('o que passou do dia sem ser feito fica atrasado, nunca concluído nem apagado', () => {
    const lista = [
      atividade('a', { data: '2026-11-23' }),
      atividade('b', { data: '2026-11-24', estado: 'feita' }),
      atividade('c', { data: '2026-11-24', estado: 'removida' }),
      atividade('d', { data: HOJE }),
    ]
    expect(atrasadas(lista, HOJE).map((a) => a.id)).toEqual(['a'])
  })

  it('o dia mostra as atividades na ordem e sem as removidas', () => {
    const lista = [atividade('b', { ordem: 2 }), atividade('a', { ordem: 1 }), atividade('x', { estado: 'removida' })]
    expect(doDia(lista, SEGUNDA).map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('reagendar guarda de onde veio e preserva a data original', () => {
    const a = atividade('a', { data: '2026-11-23' })
    const r1 = reagendar(a, '2026-11-25', 1)
    expect(r1).toEqual({ data: '2026-11-25', reagendamentos: [{ de: '2026-11-23', para: '2026-11-25', em: 1 }] })
    const r2 = reagendar({ ...a, ...r1 }, '2026-12-01', 2)
    expect(r2.reagendamentos).toHaveLength(2)
    expect({ ...a, ...r2 }.dataOriginal).toBe('2026-11-23')
    expect(reagendar(a, a.data)).toEqual({ data: a.data, reagendamentos: [] })
  })
})

describe('resumo da semana (histórico)', () => {
  it('conta planejado, feito, não realizado, reagendado, removido e tempo', () => {
    const atividades = [
      atividade('feita', { data: '2026-11-23', estado: 'feita' }),
      atividade('nao-feita', { data: '2026-11-24' }),
      atividade('hoje', { data: HOJE }),
      atividade('removida', { data: '2026-11-26', estado: 'removida' }),
      // Saiu desta semana para a próxima: conta como reagendada aqui.
      atividade('foi', { data: '2026-12-01', dataOriginal: '2026-11-24', reagendamentos: [{ de: '2026-11-24', para: '2026-12-01', em: 1 }] }),
      atividade('outra-semana', { data: '2026-11-30' }),
    ]
    const sessoes = [
      sessao('s1', { conteudoId: 'c1', minutos: 30 }),
      sessao('s2', { conteudoId: 'c1', minutos: 15, data: '2026-11-24' }),
      sessao('s3', { conteudoId: 'c2', tipo: 'revisao', minutos: 20 }),
      sessao('fora', { data: '2026-11-30', minutos: 999 }),
    ]
    const r = resumirSemana(atividades, sessoes, SEGUNDA, HOJE)
    expect(r).toMatchObject({
      planejadas: 3,
      feitas: 1,
      pendentes: 2,
      naoRealizadas: 1,
      removidas: 1,
      percentual: 33,
      conteudosEstudados: 1,
      revisoesFeitas: 1,
      minutos: 65,
    })
    expect(r.reagendadas.map((a) => a.id)).toEqual(['foi'])
  })

  it('descreve a semana em relação a hoje', () => {
    expect(descreverSemana(SEGUNDA, HOJE)).toBe('Esta semana')
    expect(descreverSemana('2026-11-16', HOJE)).toBe('Semana passada')
    expect(descreverSemana('2026-11-30', HOJE)).toBe('Próxima semana')
    expect(descreverSemana('2026-11-02', HOJE)).toBe('02/11 a 08/11')
  })
})

describe('progresso e revisões', () => {
  it('o progresso da matéria sai dos conteúdos concluídos', () => {
    const conteudos = [
      conteudo('c1', { status: 'concluido' }),
      conteudo('c2', { status: 'andamento' }),
      conteudo('c3', {}),
      conteudo('c4', { status: 'concluido' }),
      conteudo('outra', { materiaId: 'm2', status: 'concluido' }),
    ]
    const atividades = [atividade('r', { conteudoId: 'c1', tipo: 'revisao' }), atividade('e', { conteudoId: 'c3' })]
    const p = progressoDaMateria('m1', conteudos, atividades, [sessao('s', { conteudoId: 'c2', minutos: 40 })])
    expect(p).toEqual({ total: 4, concluidos: 2, andamento: 1, pendentes: 1, percentual: 50, revisoesPendentes: 1, minutos: 40 })
    expect(progressoDaMateria('vazia', conteudos, [], []).percentual).toBe(0)
  })

  it('revisões se separam em atrasadas, de hoje e próximas', () => {
    const lista = [
      atividade('atrasada', { tipo: 'revisao', data: '2026-11-20' }),
      atividade('hoje', { tipo: 'revisao', data: HOJE }),
      atividade('depois', { tipo: 'revisao', data: '2026-12-02' }),
      atividade('feita', { tipo: 'revisao', data: '2026-11-21', estado: 'feita' }),
      atividade('estudo', { data: '2026-11-20' }),
    ]
    const r = separarRevisoes(lista, HOJE)
    expect([r.atrasadas, r.hoje, r.proximas].map((l) => l.map((a) => a.id))).toEqual([['atrasada'], ['hoje'], ['depois']])
  })

  it('última revisão feita e próxima planejada, independentes da conclusão', () => {
    const atividades = [atividade('p1', { tipo: 'revisao', data: '2026-12-10' }), atividade('p2', { tipo: 'revisao', data: '2026-12-01' })]
    const sessoes = [sessao('r1', { tipo: 'revisao', data: '2026-11-10' }), sessao('r2', { tipo: 'revisao', data: '2026-11-20' }), sessao('e', { data: '2026-11-24' })]
    const { ultima, proxima } = revisoesDoConteudo('c1', atividades, sessoes)
    expect(ultima?.id).toBe('r2')
    expect(proxima?.id).toBe('p2')
  })

  it('o primeiro estudo põe em andamento; concluído só quando o usuário escolhe', () => {
    expect(statusAposEstudo('pendente', 'estudo', false)).toBe('andamento')
    expect(statusAposEstudo('pendente', 'revisao', false)).toBe('pendente')
    expect(statusAposEstudo('andamento', 'estudo', false)).toBe('andamento')
    expect(statusAposEstudo('concluido', 'estudo', false)).toBe('concluido')
    expect(statusAposEstudo('andamento', 'estudo', true)).toBe('concluido')
  })

  it('formata minutos', () => {
    expect(formatarMinutos(45)).toBe('45 min')
    expect(formatarMinutos(60)).toBe('1 h')
    expect(formatarMinutos(135)).toBe('2 h 15 min')
  })
})
