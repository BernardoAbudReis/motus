import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Preferencias } from './db'
import { alterar, salvar } from './repo'

export const ID_PREFERENCIAS = 'preferencias'

type CamposPreferencias = Omit<Preferencias, 'id' | 'updatedAt' | 'deletedAt' | 'dirty'>

const PADRAO: CamposPreferencias = {
  nome: '',
  foto: null,
  tema: 'escuro',
  lembretes: false,
}

export function usePreferencias(): CamposPreferencias {
  const p = useLiveQuery(() => db.preferencias.get(ID_PREFERENCIAS), [])
  return p ? { ...PADRAO, ...p } : PADRAO
}

export async function alterarPreferencias(mudancas: Partial<CamposPreferencias>) {
  const existe = await db.preferencias.get(ID_PREFERENCIAS)
  if (existe) await alterar<Preferencias>('preferencias', ID_PREFERENCIAS, mudancas)
  else await salvar<Preferencias>('preferencias', ID_PREFERENCIAS, { ...PADRAO, ...mudancas })
}
