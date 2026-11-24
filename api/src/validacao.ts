import { z } from 'zod'

/**
 * Formato esperado de cada coleção sincronizada (espelha web/src/db.ts).
 * Campos desconhecidos são mantidos (`loose`): versões novas do app podem
 * acrescentar campos sem quebrar o servidor. O que não pode é faltar ou vir
 * com tipo errado o que o resto do sistema usa (lembretes, estatísticas).
 */

const texto = (max: number) => z.string().max(max)
const inteiro = z.number().int()
const ms = z.number().int().nonnegative()
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const horario = z.string().regex(/^\d{2}:\d{2}$/)
const imagem = (maxBytes: number) => z.string().max(Math.ceil(maxBytes * 1.37)).nullable() // base64 ocupa ~4/3

const frequencia = z.discriminatedUnion('tipo', [
  z.looseObject({ tipo: z.literal('diaria') }),
  z.looseObject({ tipo: z.literal('dias'), dias: z.array(inteiro.min(0).max(6)).max(7) }),
])

const meta = z.discriminatedUnion('tipo', [
  z.looseObject({ tipo: z.literal('check') }),
  z.looseObject({ tipo: z.literal('quantidade'), alvo: z.number().positive(), unidade: texto(40) }),
  z.looseObject({ tipo: z.literal('tempo'), alvoMin: z.number().positive() }),
])

const habitos = z.looseObject({
  nome: texto(120),
  cor: texto(40),
  icone: texto(32),
  frequencia,
  meta,
  arquivado: z.boolean(),
  ordem: z.number(),
  criadoEm: ms,
  lembrete: z.looseObject({ ativo: z.boolean(), modo: z.enum(['auto', 'fixo']), horario }).optional(),
})

const registrosHabito = z.looseObject({
  habitoId: texto(120),
  data: dataISO,
  valor: z.number().nonnegative(),
  concluido: z.boolean(),
  concluidoEm: ms.nullable().optional(),
})

const exercicios = z.looseObject({
  nome: texto(120),
  grupoMuscular: texto(60),
  equipamento: texto(60),
  descricao: texto(2000),
  imagem: imagem(1_000_000),
  personalizado: z.boolean(),
})

const itemFicha = z.looseObject({
  id: texto(120),
  exercicioId: texto(120),
  series: inteiro.min(1).max(50),
  repeticoes: z.number().nonnegative(),
  peso: z.number().nonnegative(),
  descansoSeg: z.number().nonnegative(),
  observacoes: texto(500),
})

const fichas = z.looseObject({
  nome: texto(120),
  descricao: texto(500),
  gruposMusculares: z.array(texto(60)).max(30),
  diasSemana: z.array(inteiro.min(0).max(6)).max(7),
  itens: z.array(itemFicha).max(100),
})

const serie = z.looseObject({ peso: z.number().nonnegative(), repeticoes: z.number().nonnegative(), concluida: z.boolean() })

const sessoes = z.looseObject({
  fichaId: texto(120).nullable(),
  fichaNome: texto(120),
  iniciadaEm: ms,
  finalizadaEm: ms.nullable(),
  duracaoSeg: z.number().nonnegative(),
  observacoes: texto(2000),
  exercicios: z
    .array(
      z.looseObject({
        exercicioId: texto(120),
        nome: texto(120),
        grupoMuscular: texto(60),
        descansoSeg: z.number().nonnegative(),
        observacoes: texto(500),
        series: z.array(serie).max(50),
      }),
    )
    .max(100),
})

const preferencias = z.looseObject({
  nome: texto(100),
  foto: imagem(300_000),
  tema: z.enum(['escuro', 'claro']),
  lembretes: z.boolean(),
})

export const ESQUEMAS = { habitos, registrosHabito, exercicios, fichas, sessoes, preferencias } as const
export type Colecao = keyof typeof ESQUEMAS
export const COLECOES = Object.keys(ESQUEMAS) as Colecao[]

/** null se válido; senão, uma descrição curta do primeiro problema. */
export function validarRegistro(colecao: Colecao, id: string, dados: unknown): string | null {
  const r = ESQUEMAS[colecao].safeParse(dados)
  if (!r.success) {
    const p = r.error.issues[0]
    return `${p.path.join('.') || '(raiz)'}: ${p.message}`
  }
  // O registro do dia tem id fixo `${habitoId}_${data}`: é o que impede duplicar entre aparelhos.
  if (colecao === 'registrosHabito') {
    const d = r.data as { habitoId: string; data: string }
    if (id !== `${d.habitoId}_${d.data}`) return 'id: deve ser <habitoId>_<data>'
  }
  return null
}
