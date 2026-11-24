import { useEffect, useState } from 'react'
import { lerToken, requisicao } from '../api'

/**
 * Cronômetro de descanso entre séries. Guarda o horário de término no
 * localStorage, então continua certo se a tela apagar ou o app for fechado.
 */
interface Descanso {
  fim: number
  total: number
  exercicio?: string
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

/**
 * Com a tela bloqueada o navegador congela este cronômetro: se os lembretes
 * estiverem ativos, pede ao servidor um push para o fim do descanso.
 * Sem conta, sem permissão ou sem internet, segue só com o aviso local.
 */
async function avisarServidor(d: Descanso | null) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !(await lerToken())) return
    if (!d) return void (await requisicao('/push/descanso', { method: 'DELETE' }))
    const segundos = Math.round((d.fim - Date.now()) / 1000)
    if (segundos < 1) return
    await requisicao('/push/descanso', { method: 'POST', body: JSON.stringify({ segundos: Math.min(segundos, 900), exercicio: d.exercicio }) })
  } catch {
    // offline ou servidor sem lembretes: o aviso local continua valendo
  }
}

export function iniciarDescanso(segundos: number, exercicio?: string) {
  if (segundos <= 0) return
  const d = { fim: Date.now() + segundos * 1000, total: segundos, exercicio }
  gravar(d)
  void avisarServidor(d)
}

export function somarDescanso(segundos: number) {
  const d = ler()
  if (!d) return
  const novo = { ...d, fim: Math.max(Date.now(), d.fim + segundos * 1000), total: Math.max(1, d.total + segundos) }
  gravar(novo)
  void avisarServidor(novo)
}

export function pularDescanso() {
  const tinha = ler()
  gravar(null)
  if (tinha) void avisarServidor(null)
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
