import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { db } from '../db'

/**
 * Portão de entrada: sem conta conectada, o app mostra a tela inicial
 * (criar conta / entrar). Ao criar a conta ou redefinir a senha, o token já
 * fica salvo, mas o app só abre depois que a pessoa confirma que guardou o
 * código de recuperação: por isso o portão fica "segurando" até lá.
 */

let segurando = false
const ouvintes = new Set<() => void>()

export function segurarPortao(valor: boolean) {
  segurando = valor
  ouvintes.forEach((f) => f())
}

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

export type EstadoPortao = 'carregando' | 'visitante' | 'dentro'

export function usePortao(): EstadoPortao {
  const temToken = useLiveQuery(async () => !!(await db.meta.get('token'))?.valor, [])
  const segurandoAgora = useSyncExternalStore(assinar, () => segurando)
  if (temToken === undefined) return 'carregando'
  return temToken && !segurandoAgora ? 'dentro' : 'visitante'
}

/** Quem já entrou neste aparelho alguma vez vê "Entrar" primeiro; quem é novo vê "Criar conta". */
export const CHAVE_JA_ENTROU = 'motus-ja-entrou'
