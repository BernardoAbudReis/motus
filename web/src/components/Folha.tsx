import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from './Icone'

/**
 * Painel que sobe de baixo (no desktop, centralizado). Fecha com Esc ou tocando
 * fora. Painéis podem se empilhar (ex.: ficha > escolher exercício): o Esc
 * fecha só o de cima.
 */
export function Folha({
  titulo,
  onFechar,
  children,
  rodape,
}: {
  titulo: string
  onFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}) {
  const fundo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const todas = document.querySelectorAll('.folha-fundo')
      if (todas[todas.length - 1] === fundo.current) onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflow
    }
  }, [onFechar])

  return createPortal(
    <div className="folha-fundo" ref={fundo} onClick={onFechar}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="folha-topo">
          <h2>{titulo}</h2>
          <button className="botao-icone" aria-label="Fechar" onClick={onFechar}>
            <Icone nome="fechar" tamanho={20} />
          </button>
        </header>
        <div className="folha-corpo">{children}</div>
        {rodape && <footer className="folha-rodape">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  )
}
