import { useEffect, useState } from 'react'

/**
 * Cronômetro de descanso entre séries. Guarda o horário de término no
 * localStorage, então continua certo se a tela apagar ou o app for fechado.
 */
interface Descanso {
  fim: number
  total: number
}

const CHAVE = 'motus-descanso'
const ouvintes = new Set<() => void>()

function ler(): Descanso | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
  } catch {
    return null
  }
}

function gravar(d: Descanso | null) {
  if (d) localStorage.setItem(CHAVE, JSON.stringify(d))
  else localStorage.removeItem(CHAVE)
  ouvintes.forEach((f) => f())
}

export function iniciarDescanso(segundos: number) {
  if (segundos > 0) gravar({ fim: Date.now() + segundos * 1000, total: segundos })
}

export function somarDescanso(segundos: number) {
  const d = ler()
  if (!d) return
  const fim = Math.max(Date.now(), d.fim + segundos * 1000)
  gravar({ fim, total: Math.max(1, d.total + segundos) })
}

export function pularDescanso() {
  gravar(null)
}

export function useDescanso() {
  const [d, setD] = useState(ler)
  const [, setTique] = useState(0)

  useEffect(() => {
    const atualizar = () => setD(ler())
    ouvintes.add(atualizar)
    return () => {
      ouvintes.delete(atualizar)
    }
  }, [])

  useEffect(() => {
    if (!d) return
    const t = setInterval(() => {
      if (Date.now() >= d.fim) {
        navigator.vibrate?.([250, 120, 250])
        gravar(null)
      } else setTique((n) => n + 1)
    }, 250)
    return () => clearInterval(t)
  }, [d])

  if (!d) return null
  const restante = Math.max(0, Math.ceil((d.fim - Date.now()) / 1000))
  return { restante, total: d.total }
}
