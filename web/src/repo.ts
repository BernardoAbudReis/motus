import { tabela, type Colecao, type Sincronizavel } from './db'
import { agendarSincronizacao } from './sync'

type Campos<T> = Omit<T, keyof Sincronizavel>

export function novoId() {
  return crypto.randomUUID()
}

/**
 * Grava (cria ou altera) um registro localmente e agenda a sincronização.
 * Toda escrita do app deve passar por aqui, para o salvamento automático e o
 * envio ao servidor funcionarem sempre.
 */
export async function salvar<T extends Sincronizavel>(
  colecao: Colecao,
  id: string,
  campos: Campos<T>,
): Promise<T> {
  const registro = {
    ...campos,
    id,
    updatedAt: Date.now(),
    deletedAt: null,
    dirty: 1,
  } as unknown as T
  await tabela(colecao).put(registro)
  agendarSincronizacao()
  return registro
}

/** Altera só alguns campos de um registro existente. */
export async function alterar<T extends Sincronizavel>(
  colecao: Colecao,
  id: string,
  mudancas: Partial<Campos<T>>,
) {
  await tabela(colecao).update(id, {
    ...mudancas,
    updatedAt: Date.now(),
    dirty: 1,
  } as Partial<Sincronizavel>)
  agendarSincronizacao()
}

/** Exclusão lógica: some da tela e a exclusão é enviada aos outros aparelhos. */
export async function excluir(colecao: Colecao, id: string) {
  const agora = Date.now()
  await tabela(colecao).update(id, { deletedAt: agora, updatedAt: agora, dirty: 1 })
  agendarSincronizacao()
}

export function ativos<T extends Sincronizavel>(lista: T[]) {
  return lista.filter((r) => r.deletedAt === null)
}

/** Data local no formato AAAA-MM-DD (não usa UTC, para o dia não "virar" à noite). */
export function dataLocal(d = new Date()) {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}
