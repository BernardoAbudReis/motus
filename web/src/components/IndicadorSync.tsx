import { useEffect, useState } from 'react'
import { ouvirEstadoSync, type EstadoSync } from '../sync'

export function useEstadoSync() {
  const [estado, setEstado] = useState<EstadoSync>({ tipo: 'desconectado' })
  useEffect(() => ouvirEstadoSync(setEstado), [])
  return estado
}

export function descreverSync(e: EstadoSync) {
  switch (e.tipo) {
    case 'desconectado':
      return 'Dados só neste aparelho'
    case 'offline':
      return 'Sem internet: salvando no aparelho'
    case 'sincronizando':
      return 'Sincronizando…'
    case 'ok':
      return `Sincronizado às ${new Date(e.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    case 'erro':
      return `Erro na sincronização: ${e.mensagem}`
  }
}

/** Faixa no topo só quando importa: sem internet ou com erro. */
export function IndicadorSync() {
  const estado = useEstadoSync()
  if (estado.tipo !== 'offline' && estado.tipo !== 'erro') return null
  return (
    <div className={`faixa-sync ${estado.tipo}`} role="status">
      {descreverSync(estado)}
    </div>
  )
}
