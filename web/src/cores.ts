/**
 * Cores de hábitos e matérias. Tons sóbrios agrupados por família; sem roxo,
 * azul ou dourado nas prontas, para não competir com o menta da marca. Quem
 * quiser outra usa a cor personalizada, guardada como "#rrggbb".
 *
 * A cor do texto sobre o card concluído (todo preenchido) é calculada pelo
 * contraste, nos dois temas, então vale também para cores personalizadas.
 */
export const CORES = [
  // Verdes
  { id: 'menta', nome: 'Menta', hex: '#53E79F' },
  { id: 'jade', nome: 'Jade', hex: '#2FB57E' },
  { id: 'verde', nome: 'Verde', hex: '#5DBB63' },
  { id: 'floresta', nome: 'Floresta', hex: '#3E9B5F' },
  { id: 'limao', nome: 'Limão', hex: '#B8E05A' },
  { id: 'oliva', nome: 'Oliva', hex: '#9BB062' },
  { id: 'musgo', nome: 'Musgo', hex: '#7A8F4A' },
  { id: 'agua', nome: 'Água', hex: '#3CC2AE' },
  { id: 'petroleo', nome: 'Petróleo', hex: '#2E9C93' },
  // Vermelhos e rosas
  { id: 'vermelho', nome: 'Vermelho', hex: '#E5584F' },
  { id: 'cereja', nome: 'Cereja', hex: '#C23B4B' },
  { id: 'vinho', nome: 'Vinho', hex: '#B5475E' },
  { id: 'framboesa', nome: 'Framboesa', hex: '#D9507A' },
  { id: 'rosa', nome: 'Rosa', hex: '#D96C8A' },
  { id: 'salmao', nome: 'Salmão', hex: '#F59A8A' },
  { id: 'coral', nome: 'Coral', hex: '#F08A7E' },
  // Laranjas e terrosos
  { id: 'laranja', nome: 'Laranja', hex: '#E5864E' },
  { id: 'ferrugem', nome: 'Ferrugem', hex: '#C0633A' },
  { id: 'pessego', nome: 'Pêssego', hex: '#F0A983' },
  { id: 'caramelo', nome: 'Caramelo', hex: '#D19A5B' },
  { id: 'terra', nome: 'Terra', hex: '#B4876A' },
  { id: 'cafe', nome: 'Café', hex: '#9C6B4E' },
  { id: 'chocolate', nome: 'Chocolate', hex: '#7B5440' },
  { id: 'areia', nome: 'Areia', hex: '#CDB99A' },
  // Neutros
  { id: 'grafite', nome: 'Grafite', hex: '#A3A5AA' },
  { id: 'pedra', nome: 'Pedra', hex: '#7E8A8C' },
  { id: 'ardosia', nome: 'Ardósia', hex: '#6F7D8C' },
] as const

const HEX = /^#[0-9a-f]{6}$/i

export function corPersonalizada(cor: string) {
  return HEX.test(cor)
}

/** Hex da cor: uma das prontas (pelo id) ou a personalizada. */
export function corHex(cor: string): string {
  if (corPersonalizada(cor)) return cor.toUpperCase()
  return CORES.find((c) => c.id === cor)?.hex ?? CORES[0].hex
}

export function nomeDaCor(cor: string) {
  return corPersonalizada(cor) ? 'Personalizada' : (CORES.find((c) => c.id === cor)?.nome ?? CORES[0].nome)
}

/* ---------- Contraste (WCAG) ---------- */

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const misturar = (a: number[], b: number[], p: number) => a.map((v, i) => v * p + b[i] * (1 - p))

function luminancia(c: number[]) {
  const [r, g, b] = c.map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: number[], b: number[]) {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export const TINTA_ESCURA = rgb('#090C15')
export const TINTA_CLARA = rgb('#F6F5F6')
const SUPERFICIE = { escuro: rgb('#111722'), claro: rgb('#FFFFFF') }

/** Mesma conta do CSS: o card concluído é color-mix(cor 74%, superfície do tema). */
export function preenchimento(cor: string, tema: 'escuro' | 'claro') {
  return misturar(rgb(corHex(cor)), SUPERFICIE[tema], 0.74)
}

export type Tinta = 'escura' | 'clara'

/** Cor do texto sobre o card preenchido: a de maior contraste naquele tema. */
export function tinta(cor: string, tema: 'escuro' | 'claro'): Tinta {
  const fundo = preenchimento(cor, tema)
  return contraste(fundo, TINTA_ESCURA) >= contraste(fundo, TINTA_CLARA) ? 'escura' : 'clara'
}

/** Atributos para o card: data-tinta (tema escuro) e data-tinta-claro (tema claro). */
export function atributosTinta(cor: string) {
  return { 'data-tinta': tinta(cor, 'escuro'), 'data-tinta-claro': tinta(cor, 'claro') }
}

/** Cor do ícone sobre a cor pura (ex.: botão salvar preenchido com a cor escolhida). */
export function tintaSobreCor(cor: string) {
  const fundo = rgb(corHex(cor))
  return contraste(fundo, TINTA_ESCURA) >= contraste(fundo, TINTA_CLARA) ? '#090C15' : '#F6F5F6'
}
