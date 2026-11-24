import Dexie, { type Table } from 'dexie'

/**
 * Banco local (IndexedDB). É a fonte de verdade do aparelho: tudo é gravado
 * aqui primeiro e depois sincronizado com o servidor (ver sync.ts).
 *
 * Todo registro sincronizável tem:
 * - id: gerado no aparelho, o servidor faz upsert por ele, então reenviar não duplica;
 * - updatedAt: data da última alteração (ms), usada para decidir conflitos;
 * - deletedAt: exclusão lógica, para a exclusão também chegar aos outros aparelhos;
 * - dirty: 1 enquanto a alteração não foi enviada ao servidor.
 */
export interface Sincronizavel {
  id: string
  updatedAt: number
  deletedAt: number | null
  dirty: 0 | 1
}

export type Frequencia =
  | { tipo: 'diaria' }
  | { tipo: 'dias'; dias: number[] } // 0 = domingo ... 6 = sábado

export type Meta =
  | { tipo: 'check' }
  | { tipo: 'quantidade'; alvo: number; unidade: string }
  | { tipo: 'tempo'; alvoMin: number }

/**
 * Lembrete do hábito. "auto": avisa na média dos horários em que o hábito foi
 * concluído (com poucas conclusões, usa `horario`). "fixo": sempre em `horario`.
 */
export interface Lembrete {
  ativo: boolean
  modo: 'auto' | 'fixo'
  horario: string // HH:MM
}

export interface Habito extends Sincronizavel {
  nome: string
  cor: string
  icone: string
  frequencia: Frequencia
  meta: Meta
  arquivado: boolean
  ordem: number
  criadoEm: number
  /** Ausente em hábitos antigos: vale o padrão (ativo, automático). */
  lembrete?: Lembrete
}

/** Um registro por hábito por dia. id = `${habitoId}_${data}`, então dois aparelhos marcando o mesmo dia não duplicam. */
export interface RegistroHabito extends Sincronizavel {
  habitoId: string
  data: string // AAAA-MM-DD, no fuso do usuário
  valor: number // minutos, quantidade ou 1 para check
  concluido: boolean
  /** Quando foi concluído (ms). Só registrado para conclusões no próprio dia: alimenta o horário do lembrete. */
  concluidoEm?: number | null
}

export interface Exercicio extends Sincronizavel {
  nome: string
  grupoMuscular: string
  equipamento: string
  descricao: string
  imagem: string | null
  personalizado: boolean
}

export interface ItemFicha {
  id: string // o mesmo exercício pode aparecer duas vezes na ficha
  exercicioId: string
  series: number
  repeticoes: number
  peso: number
  descansoSeg: number
  observacoes: string
}

export interface Ficha extends Sincronizavel {
  nome: string
  descricao: string
  gruposMusculares: string[]
  diasSemana: number[]
  itens: ItemFicha[] // a ordem do array é a ordem dos exercícios
}

export interface SerieRealizada {
  peso: number
  repeticoes: number
  concluida: boolean
}

/**
 * Cópia (snapshot) da ficha no momento do treino: nomes e configuração são
 * copiados, então editar a ficha depois não altera treinos já realizados.
 */
export interface ExercicioSessao {
  exercicioId: string
  nome: string
  grupoMuscular: string
  equipamento: string
  repeticoesPlanejadas: number
  descansoSeg: number
  observacoes: string
  series: SerieRealizada[]
}

export interface SessaoTreino extends Sincronizavel {
  fichaId: string | null
  fichaNome: string
  iniciadaEm: number
  finalizadaEm: number | null
  duracaoSeg: number
  observacoes: string
  exercicios: ExercicioSessao[]
}

export interface Preferencias extends Sincronizavel {
  // id fixo: 'preferencias'
  nome: string
  foto: string | null
  tema: 'escuro' | 'claro'
  lembretes: boolean
}

/* ---------- Estudos ----------
 * Setor → Matéria → Conteúdo. O planejamento são as Atividades (estudo ou
 * revisão num dia); a execução são as Sessões. Progresso, tempo estudado e
 * resumos são calculados na hora (estudos/logica.ts), nunca guardados.
 */

export interface Setor extends Sincronizavel {
  nome: string
  ordem: number
  arquivado: boolean
}

export interface Materia extends Sincronizavel {
  setorId: string
  nome: string
  cor: string // id de CORES_HABITO
  icone: string // emoji opcional ('' = sem ícone)
  descricao: string
  ordem: number
  arquivada: boolean
}

export type StatusConteudo = 'pendente' | 'andamento' | 'concluido'
export type Prioridade = 'baixa' | 'media' | 'alta'
export type TipoEstudo = 'estudo' | 'revisao'

export interface Conteudo extends Sincronizavel {
  materiaId: string
  nome: string
  descricao: string
  ordem: number
  prioridade: Prioridade
  status: StatusConteudo
  tempoEstimadoMin: number | null
  concluidoEm: string | null // AAAA-MM-DD
  observacoes: string
}

/** Cada mudança de data fica registrada: o histórico mostra o que foi reagendado. */
export interface Reagendamento {
  de: string
  para: string
  em: number
}

/**
 * Um estudo ou revisão planejado para um dia. Nunca é concluído sozinho:
 * passou do dia sem ser feito, continua "planejada" (aparece como atrasada).
 * Remover é lógico (estado "removida"), para o histórico continuar completo.
 */
export interface Atividade extends Sincronizavel {
  conteudoId: string
  tipo: TipoEstudo
  data: string // dia atual planejado
  dataOriginal: string // primeiro dia planejado, preservado ao reagendar
  ordem: number
  estado: 'planejada' | 'feita' | 'removida'
  reagendamentos: Reagendamento[]
  feitaEm: number | null
}

export type Dificuldade = 'facil' | 'media' | 'dificil'

/** O que foi de fato estudado ou revisado (com ou sem atividade planejada). */
export interface SessaoEstudo extends Sincronizavel {
  conteudoId: string
  tipo: TipoEstudo
  data: string
  minutos: number | null
  dificuldade: Dificuldade | null
  observacoes: string
  atividadeId: string | null
}

/** Dados só do aparelho (nunca sincronizados): token, cursor de sincronização etc. */
export interface MetaLocal {
  chave: string
  valor: unknown
}

export const COLECOES = [
  'habitos',
  'registrosHabito',
  'exercicios',
  'fichas',
  'sessoes',
  'preferencias',
  'setores',
  'materias',
  'conteudos',
  'atividades',
  'sessoesEstudo',
] as const
export type Colecao = (typeof COLECOES)[number]

class BancoLocal extends Dexie {
  habitos!: Table<Habito, string>
  registrosHabito!: Table<RegistroHabito, string>
  exercicios!: Table<Exercicio, string>
  fichas!: Table<Ficha, string>
  sessoes!: Table<SessaoTreino, string>
  preferencias!: Table<Preferencias, string>
  setores!: Table<Setor, string>
  materias!: Table<Materia, string>
  conteudos!: Table<Conteudo, string>
  atividades!: Table<Atividade, string>
  sessoesEstudo!: Table<SessaoEstudo, string>
  meta!: Table<MetaLocal, string>

  constructor() {
    super('habitos-academia')
    this.version(1).stores({
      habitos: 'id, dirty, ordem',
      registrosHabito: 'id, dirty, habitoId, data, [habitoId+data]',
      exercicios: 'id, dirty, grupoMuscular, nome',
      fichas: 'id, dirty',
      sessoes: 'id, dirty, fichaId, iniciadaEm',
      preferencias: 'id, dirty',
      meta: 'chave',
    })
    this.version(2).stores({
      setores: 'id, dirty',
      materias: 'id, dirty, setorId',
      conteudos: 'id, dirty, materiaId',
      atividades: 'id, dirty, conteudoId, data',
      sessoesEstudo: 'id, dirty, conteudoId, data',
    })
  }
}

export const db = new BancoLocal()

export function tabela(colecao: Colecao): Table<Sincronizavel, string> {
  return db[colecao] as unknown as Table<Sincronizavel, string>
}

export async function lerMeta<T>(chave: string): Promise<T | undefined> {
  return (await db.meta.get(chave))?.valor as T | undefined
}

export async function gravarMeta(chave: string, valor: unknown) {
  await db.meta.put({ chave, valor })
}

/** Pede ao navegador para não apagar o IndexedDB quando faltar espaço. */
export async function pedirArmazenamentoPersistente() {
  if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
    await navigator.storage.persist()
  }
}
