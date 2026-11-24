import { describe, expect, it } from 'vitest'
import { CORES_HABITO } from './dados'

// Mesma conta do CSS: o card concluído é color-mix(cor 74%, superfície).
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const misturar = (a: number[], b: number[], p: number) => a.map((v, i) => v * p + b[i] * (1 - p))
function luminancia(c: number[]) {
  const [r, g, b] = c.map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a: number[], b: number[]) {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TINTA_ESCURA = rgb('#090c15')
const TINTA_CLARA = rgb('#f6f5f6')
const SUPERFICIE_ESCURO = rgb('#111722')
const SUPERFICIE_CLARO = rgb('#ffffff')

describe('cores dos hábitos', () => {
  it('ids e cores não se repetem', () => {
    expect(new Set(CORES_HABITO.map((c) => c.id)).size).toBe(CORES_HABITO.length)
    expect(new Set(CORES_HABITO.map((c) => c.hex.toLowerCase())).size).toBe(CORES_HABITO.length)
  })

  it.each(CORES_HABITO)('$nome: texto do card concluído com contraste ≥ 4,5:1 nos dois temas', (c) => {
    const tinta = c.tinta === 'escura' ? TINTA_ESCURA : TINTA_CLARA
    expect(contraste(misturar(rgb(c.hex), SUPERFICIE_ESCURO, 0.74), tinta)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(misturar(rgb(c.hex), SUPERFICIE_CLARO, 0.74), TINTA_ESCURA)).toBeGreaterThanOrEqual(4.5)
  })
})
