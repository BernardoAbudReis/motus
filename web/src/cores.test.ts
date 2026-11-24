import { describe, expect, it } from 'vitest'
import { CORES, TINTA_CLARA, TINTA_ESCURA, contraste, corHex, corPersonalizada, nomeDaCor, preenchimento, tinta } from './cores'

const corDaTinta = (t: 'escura' | 'clara') => (t === 'escura' ? TINTA_ESCURA : TINTA_CLARA)

describe('cores de hábitos e matérias', () => {
  it('ids e cores prontas não se repetem', () => {
    expect(new Set(CORES.map((c) => c.id)).size).toBe(CORES.length)
    expect(new Set(CORES.map((c) => c.hex.toLowerCase())).size).toBe(CORES.length)
  })

  it.each(CORES)('$nome: texto do card concluído com contraste ≥ 4,5:1 nos dois temas', (c) => {
    for (const tema of ['escuro', 'claro'] as const) {
      expect(contraste(preenchimento(c.id, tema), corDaTinta(tinta(c.id, tema)))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('cor personalizada é guardada como hex e usada como veio', () => {
    expect(corPersonalizada('#1A2B3C')).toBe(true)
    expect(corPersonalizada('menta')).toBe(false)
    expect(corPersonalizada('#12345')).toBe(false)
    expect(corHex('#1a2b3c')).toBe('#1A2B3C')
    expect(nomeDaCor('#1a2b3c')).toBe('Personalizada')
  })

  it('cor desconhecida volta para a menta', () => {
    expect(corHex('nao-existe')).toBe('#53E79F')
  })

  it('cor personalizada escura ganha texto claro nos dois temas; clara ganha texto escuro', () => {
    expect(tinta('#202020', 'escuro')).toBe('clara')
    expect(tinta('#202020', 'claro')).toBe('clara')
    expect(tinta('#FAFAFA', 'escuro')).toBe('escura')
    expect(tinta('#FAFAFA', 'claro')).toBe('escura')
  })
})
