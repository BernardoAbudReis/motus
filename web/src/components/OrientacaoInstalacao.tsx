import { useEffect, useState } from 'react'
import {
  ehIOS,
  ehSafariIOS,
  estaInstalado,
  instalar,
  ouvirInstalacao,
  podeInstalarDireto,
} from '../instalacao'

/** Passo a passo de instalação conforme o navegador. Usado no banner e em Configurações. */
export function PassosInstalacao() {
  const [, forcar] = useState(0)
  useEffect(() => ouvirInstalacao(() => forcar((n) => n + 1)), [])

  if (estaInstalado()) return <p>✅ O app já está instalado neste aparelho.</p>

  if (podeInstalarDireto()) {
    return (
      <button className="botao primario largo" onClick={() => void instalar()}>
        📲 Instalar o app
      </button>
    )
  }

  if (ehIOS() && !ehSafariIOS()) {
    return <p>No iPhone, a instalação é feita pelo <strong>Safari</strong>. Abra este endereço no Safari.</p>
  }

  if (ehSafariIOS()) {
    return (
      <ol className="passos">
        <li>
          Toque em <strong>Compartilhar</strong> <span aria-hidden>⬆️</span> na barra do Safari.
        </li>
        <li>
          Escolha <strong>Adicionar à Tela de Início</strong>.
        </li>
        <li>
          Deixe <strong>Abrir como App da Web</strong> ligado e toque em <strong>Adicionar</strong>.
        </li>
        <li>Abra o app pelo ícone na tela de início.</li>
      </ol>
    )
  }

  return (
    <ol className="passos">
      <li>
        Abra o menu do navegador <strong>⋮</strong>.
      </li>
      <li>
        Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
      </li>
    </ol>
  )
}

const CHAVE_DISPENSA = 'instalacao-dispensada'

/** Banner discreto no topo, só para quem ainda não instalou e não dispensou. */
export function BannerInstalacao() {
  const [visivel, setVisivel] = useState(
    () => !estaInstalado() && localStorage.getItem(CHAVE_DISPENSA) !== '1',
  )
  const [, forcar] = useState(0)
  useEffect(() => ouvirInstalacao(() => forcar((n) => n + 1)), [])

  // Só aparece quando há algo útil a mostrar: botão de instalar ou passo a passo do iPhone.
  if (!visivel || estaInstalado() || (!podeInstalarDireto() && !ehIOS())) return null

  return (
    <div className="banner" role="region" aria-label="Instalar o app">
      <div className="banner-texto">
        <strong>Instale o app na tela inicial</strong>
        <PassosInstalacao />
      </div>
      <button
        className="botao-icone"
        aria-label="Dispensar"
        onClick={() => {
          localStorage.setItem(CHAVE_DISPENSA, '1')
          setVisivel(false)
        }}
      >
        ✕
      </button>
    </div>
  )
}
