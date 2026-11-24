import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, gravarMeta, lerMeta, type Exercicio, type Ficha, type SessaoTreino } from '../db'
import { alterar, ativos, excluir, novoId, salvar } from '../repo'
import { agendarSincronizacao } from '../sync'
import { EXERCICIOS_BASE } from './catalogo'
import { criarSessao, gruposDaFicha } from './logica'

export type CamposExercicio = Pick<Exercicio, 'nome' | 'grupoMuscular' | 'equipamento' | 'descricao' | 'imagem'>
export type CamposFicha = Pick<Ficha, 'nome' | 'descricao' | 'diasSemana' | 'itens'>

export function useExercicios(): Exercicio[] | undefined {
  return useLiveQuery(async () => ativos(await db.exercicios.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
}

export function useExerciciosPorId(lista: Exercicio[] | undefined) {
  return useMemo(() => new Map((lista ?? []).map((e) => [e.id, e])), [lista])
}

export function useFichas(): Ficha[] | undefined {
  return useLiveQuery(async () => ativos(await db.fichas.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
}

export function useSessoes(): SessaoTreino[] | undefined {
  return useLiveQuery(async () => ativos(await db.sessoes.orderBy('iniciadaEm').reverse().toArray()), [])
}

/** O treino em andamento (no máximo um), ou null. */
export function sessaoAtiva(sessoes: SessaoTreino[] | undefined) {
  return sessoes?.find((s) => s.finalizadaEm === null) ?? null
}

/**
 * Cria a biblioteca inicial uma vez por aparelho. Ids fixos: se outro aparelho
 * já criou, o registro existe e não é refeito; se o usuário excluiu um
 * exercício da base, a exclusão é respeitada.
 */
export async function garantirBiblioteca() {
  if (await lerMeta<boolean>('biblioteca-v1')) return
  // Uma transação só: a lista aparece inteira, nunca pela metade.
  await db.transaction('rw', db.exercicios, db.meta, async () => {
    const existentes = new Set((await db.exercicios.bulkGet(EXERCICIOS_BASE.map((e) => e.id))).filter(Boolean).map((e) => e!.id))
    const agora = Date.now()
    await db.exercicios.bulkPut(
      EXERCICIOS_BASE.filter((e) => !existentes.has(e.id)).map(
        (e): Exercicio => ({
          id: e.id,
          nome: e.nome,
          grupoMuscular: e.grupoMuscular,
          equipamento: e.equipamento,
          descricao: '',
          imagem: null,
          personalizado: false,
          updatedAt: agora,
          deletedAt: null,
          dirty: 1,
        }),
      ),
    )
    await gravarMeta('biblioteca-v1', true)
  })
  agendarSincronizacao()
}

export async function salvarExercicio(id: string | null, campos: CamposExercicio) {
  if (id) return alterar<Exercicio>('exercicios', id, campos)
  return salvar<Exercicio>('exercicios', novoId(), { ...campos, personalizado: true })
}

export function excluirExercicio(id: string) {
  return excluir('exercicios', id)
}

async function grupos(itens: Ficha['itens']) {
  const exercicios = await db.exercicios.bulkGet(itens.map((i) => i.exercicioId))
  return gruposDaFicha(itens, new Map(exercicios.filter((e): e is Exercicio => !!e).map((e) => [e.id, e])))
}

export async function salvarFicha(id: string | null, campos: CamposFicha) {
  const gruposMusculares = await grupos(campos.itens)
  if (id) return alterar<Ficha>('fichas', id, { ...campos, gruposMusculares })
  return salvar<Ficha>('fichas', novoId(), { ...campos, gruposMusculares })
}

export async function duplicarFicha(f: Ficha) {
  return salvar<Ficha>('fichas', novoId(), {
    nome: `${f.nome} (cópia)`,
    descricao: f.descricao,
    diasSemana: [...f.diasSemana],
    gruposMusculares: [...f.gruposMusculares],
    itens: f.itens.map((i) => ({ ...i, id: novoId() })),
  })
}

export function excluirFicha(id: string) {
  return excluir('fichas', id)
}

export async function iniciarTreino(ficha: Ficha) {
  const sessoes = ativos(await db.sessoes.toArray())
  const andamento = sessoes.find((s) => s.finalizadaEm === null)
  if (andamento) return andamento.id
  const exercicios = await db.exercicios.toArray()
  const campos = criarSessao(ficha, new Map(exercicios.map((e) => [e.id, e])), sessoes)
  const id = novoId()
  await salvar<SessaoTreino>('sessoes', id, campos)
  return id
}

/**
 * Altera o treino a partir do que está gravado, dentro de uma transação:
 * toques rápidos (ex.: concluir duas séries seguidas) não se perdem.
 */
export function modificarSessao(id: string, fn: (s: SessaoTreino) => Partial<SessaoTreino>) {
  return db.transaction('rw', db.sessoes, async () => {
    const s = await db.sessoes.get(id)
    if (!s || s.deletedAt !== null) return
    await alterar<SessaoTreino>('sessoes', id, fn(s))
  })
}

export function finalizarTreino(id: string, observacoes: string) {
  const agora = Date.now()
  return modificarSessao(id, (s) => ({
    observacoes,
    finalizadaEm: agora,
    duracaoSeg: Math.round((agora - s.iniciadaEm) / 1000),
  }))
}

export function excluirTreino(id: string) {
  return excluir('sessoes', id)
}

/** Reduz a foto do exercício para no máximo 480 px, em JPEG, para caber no banco e sincronizar rápido. */
export function reduzirImagem(arquivo: File, lado = 480): Promise<string> {
  return new Promise((ok, erro) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      ok(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => erro(new Error('Não foi possível ler a imagem.'))
    img.src = URL.createObjectURL(arquivo)
  })
}
