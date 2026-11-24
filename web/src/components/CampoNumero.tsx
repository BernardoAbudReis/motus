import { useEffect, useState } from 'react'
import { lerNumero, numero } from '../academia/logica'

/**
 * Campo numérico que aceita vírgula ("22,5"), comum no teclado brasileiro.
 * Grava a cada número válido digitado; ao sair do campo, volta ao último valor válido.
 */
export function CampoNumero({
  valor,
  onMudar,
  rotulo,
  sufixo,
  inteiro = false,
  className = '',
}: {
  valor: number
  onMudar: (n: number) => void
  rotulo: string
  sufixo?: string
  inteiro?: boolean
  className?: string
}) {
  const [texto, setTexto] = useState(() => numero(valor, 2))
  const [focado, setFocado] = useState(false)

  useEffect(() => {
    if (!focado) setTexto(numero(valor, 2))
  }, [valor, focado])

  return (
    <label className={`campo-numero ${className}`}>
      <input
        type="text"
        inputMode={inteiro ? 'numeric' : 'decimal'}
        aria-label={rotulo}
        value={texto}
        onFocus={(e) => {
          setFocado(true)
          e.target.select()
        }}
        onBlur={() => {
          setFocado(false)
          setTexto(numero(valor, 2))
        }}
        onChange={(e) => {
          setTexto(e.target.value)
          const n = lerNumero(e.target.value)
          if (n !== null) onMudar(inteiro ? Math.round(n) : n)
        }}
      />
      {sufixo && <span aria-hidden>{sufixo}</span>}
    </label>
  )
}
