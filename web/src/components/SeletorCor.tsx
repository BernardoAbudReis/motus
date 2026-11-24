import type { CSSProperties } from 'react'
import { CORES, corHex, corPersonalizada } from '../cores'
import { Icone } from './Icone'

/**
 * Grade de cores prontas e, no fim, a cor personalizada: abre o seletor de
 * cores do próprio aparelho. A escolhida fica guardada como "#rrggbb".
 */
export function SeletorCor({ valor, onMudar }: { valor: string; onMudar: (cor: string) => void }) {
  const personalizada = corPersonalizada(valor)
  return (
    <>
      <div className="grade-cores">
        {CORES.map((c) => (
          <button
            type="button"
            key={c.id}
            className={c.id === valor ? 'ativo' : ''}
            style={{ '--cor': c.hex } as CSSProperties}
            aria-label={c.nome}
            aria-pressed={c.id === valor}
            onClick={() => onMudar(c.id)}
          />
        ))}
        <label
          className={`cor-personalizada ${personalizada ? 'ativo escolhida' : ''}`}
          style={personalizada ? ({ '--cor': corHex(valor) } as CSSProperties) : undefined}
          title="Cor personalizada"
        >
          {!personalizada && <Icone nome="mais" tamanho={18} espessura={2.6} />}
          <input
            type="color"
            aria-label="Cor personalizada"
            value={personalizada ? valor.toLowerCase() : '#53e79f'}
            onChange={(e) => onMudar(e.target.value.toUpperCase())}
          />
        </label>
      </div>
      <p className="sutil dica-cor">{personalizada ? `Cor personalizada ${corHex(valor)}. Toque no último círculo para trocar.` : 'O último círculo cria uma cor personalizada.'}</p>
    </>
  )
}
