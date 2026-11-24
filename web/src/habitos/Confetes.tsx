import confetti from 'canvas-confetti'
import { useEffect } from 'react'
import { EVENTO_CONCLUIDO, type DetalheConcluido } from './dados'

const MENTA = '#53E79F'
const BRANCO = '#F6F5F6'

/**
 * Comemoração ao concluir um hábito: confetes saindo do botão do card, nas
 * cores da marca e do hábito. Respeita "reduzir movimento" do sistema.
 * Desenha num canvas próprio, na linha principal (sem worker): é uma animação
 * curta, e assim funciona igual em qualquer navegador.
 */
export function Confetes() {
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.className = 'canvas-confetes'
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)
    const disparar = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })

    function comemorar(e: Event) {
      const { habitoId, cor } = (e as CustomEvent<DetalheConcluido>).detail
      const botao = document.querySelector(`[data-habito-id="${CSS.escape(habitoId)}"] .botao-anel`)
      const caixa = botao?.getBoundingClientRect()
      const origem = caixa
        ? { x: (caixa.left + caixa.width / 2) / innerWidth, y: (caixa.top + caixa.height / 2) / innerHeight }
        : { x: 0.5, y: 0.6 }
      const comum = { origin: origem, colors: [MENTA, cor, BRANCO], ticks: 160, scalar: 0.9 }
      void disparar({ ...comum, particleCount: 70, spread: 75, startVelocity: 38, angle: 110 })
      void disparar({ ...comum, particleCount: 40, spread: 55, startVelocity: 30, angle: 70 })
    }

    window.addEventListener(EVENTO_CONCLUIDO, comemorar)
    return () => {
      window.removeEventListener(EVENTO_CONCLUIDO, comemorar)
      disparar.reset()
      canvas.remove()
    }
  }, [])
  return null
}
