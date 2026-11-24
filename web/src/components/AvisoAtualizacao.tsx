import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UMA_HORA = 60 * 60 * 1000

/**
 * Quando uma nova versão é publicada, o service worker baixa os arquivos em
 * segundo plano e este aviso aparece. O usuário toca em "Atualizar" e o app
 * recarrega na versão nova, sem perder dados (eles ficam no IndexedDB).
 */
export function AvisoAtualizacao() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    offlineReady: [prontoOffline, setProntoOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Apps instalados ficam abertos por dias: procura versão nova a cada hora.
      if (registro) setInterval(() => void registro.update(), UMA_HORA)
    },
  })

  // Todos os hooks antes de qualquer return: um hook depois do aviso de nova
  // versão quebrava a tela inteira justamente quando havia atualização.
  useEffect(() => {
    if (!prontoOffline) return
    const t = setTimeout(() => setProntoOffline(false), 4000)
    return () => clearTimeout(t)
  }, [prontoOffline, setProntoOffline])

  if (precisaAtualizar) {
    return (
      <div className="aviso" role="alert">
        <span>Nova versão disponível.</span>
        <button className="botao primario" onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </button>
        <button className="botao-icone" aria-label="Depois" onClick={() => setPrecisaAtualizar(false)}>
          ✕
        </button>
      </div>
    )
  }

  if (prontoOffline) {
    return (
      <div className="aviso" role="status">
        <span>Pronto para usar sem internet.</span>
        <button className="botao-icone" aria-label="Fechar" onClick={() => setProntoOffline(false)}>
          ✕
        </button>
      </div>
    )
  }

  return null
}
