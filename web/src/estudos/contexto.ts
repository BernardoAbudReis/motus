import { createContext, useContext } from 'react'
import type { Atividade, Conteudo, Materia, Prioridade, StatusConteudo, TipoEstudo } from '../db'
import { corDoHabito } from '../habitos/dados'
import type { DadosEstudos } from './dados'

export const ROTULO_STATUS: Record<StatusConteudo, string> = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  concluido: 'Concluído',
}

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

export const ROTULO_TIPO: Record<TipoEstudo, string> = { estudo: 'Estudo', revisao: 'Revisão' }

export interface Indices {
  conteudo: Map<string, Conteudo>
  materia: Map<string, Materia>
}

export function indexar(d: DadosEstudos): Indices {
  return {
    conteudo: new Map(d.conteudos.map((c) => [c.id, c])),
    materia: new Map(d.materias.map((m) => [m.id, m])),
  }
}

/** O que abre os painéis de Estudos, de qualquer tela. */
export interface Acoes {
  dados: DadosEstudos
  indices: Indices
  hoje: string
  abrirAtividade: (a: Atividade) => void
  abrirConteudo: (id: string) => void
  abrirMateria: (id: string) => void
  planejar: (preset?: { conteudoId?: string; tipo?: TipoEstudo; data?: string }) => void
  registrar: (preset?: { conteudoId?: string; tipo?: TipoEstudo }) => void
  concluir: (a: Atividade) => void
}

export const ContextoEstudos = createContext<Acoes | null>(null)

export function useAcoes() {
  const c = useContext(ContextoEstudos)
  if (!c) throw new Error('Fora de Estudos')
  return c
}

export function corMateria(m?: Materia) {
  return corDoHabito(m?.cor ?? 'menta')
}

