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

export interface Habito extends Sincronizavel {
  nome: string
  cor: string
  icone: string
  frequencia: Frequencia
  meta: Meta
  arquivado: boolean
  ordem: number
  criadoEm: number
}

/** Um registro por hábito por dia. id = `${habitoId}_${data}`, então dois aparelhos marcando o mesmo dia não duplicam. */
export interface RegistroHabito extends Sincronizavel {
  habitoId: string
  data: string // AAAA-MM-DD, no fuso do usuário
  valor: number // minutos, quantidade ou 1 para check
  concluido: boolean
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
] as const
export type Colecao = (typeof COLECOES)[number]

class BancoLocal extends Dexie {
  habitos!: Table<Habito, string>
  registrosHabito!: Table<RegistroHabito, string>
  exercicios!: Table<Exercicio, string>
  fichas!: Table<Ficha, string>
  sessoes!: Table<SessaoTreino, string>
  preferencias!: Table<Preferencias, string>
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
