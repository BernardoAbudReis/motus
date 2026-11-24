import { useEffect, useState } from 'react'
import type { Habito } from '../db'
import { somar } from './dados'

/**
 * Cronômetro para hábitos de tempo (ex.: "Ler 30 min"). Fica no localStorage
 * pelo horário de início, então continua contando se o app for fechado ou o
 * celular bloquear. Ao parar, os minutos são somados ao registro do dia.
 */
interface Cronometro {
  habitoId: string
  data: string
  inicio: number
}

const CHAVE = 'motus-cronometro'
const ouvintes = new Set<() => void>()

function ler(): Cronometro | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
  } catch {
    return null
  }
}

function gravar(c: Cronometro | null) {
  if (c) localStorage.setItem(CHAVE, JSON.stringify(c))
  else localStorage.removeItem(CHAVE)
  ouvintes.forEach((f) => f())
}

export function useCronometro() {
  const [cron, setCron] = useState(ler)
  const [, setTique] = useState(0)

  useEffect(() => {
    const atualizar = () => setCron(ler())
    ouvintes.add(atualizar)
    window.addEventListener('storage', atualizar) // outra aba
    return () => {
      ouvintes.delete(atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])

  useEffect(() => {
    if (!cron) return
    const t = setInterval(() => setTique((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [cron])

  const segundos = cron ? Math.max(0, Math.floor((Date.now() - cron.inicio) / 1000)) : 0
  return { cron, segundos }
}

export function iniciarCronometro(habitoId: string, data: string) {
  gravar({ habitoId, data, inicio: Date.now() })
}

/** Para e soma o tempo ao dia em que o cronômetro foi iniciado. */
export async function pararCronometro(h: Habito) {
  const c = ler()
  gravar(null)
  if (!c) return
  const seg = (Date.now() - c.inicio) / 1000
  const minutos = seg < 30 ? 0 : Math.max(1, Math.round(seg / 60))
  if (minutos > 0) await somar(h, c.data, minutos)
}

export function formatarDuracao(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
