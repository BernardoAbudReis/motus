import { useEffect, useRef, useState } from 'react'
import { formatarPeso, formatarVolume, type PontoEvolucao } from './logica'

const ALTURA = 180
const MARGEM = { topo: 16, direita: 56, base: 26, esquerda: 36 }

function data(ms: number, ano = false) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(ano ? { year: '2-digit' } : {}) })
}

/** Valores "redondos" para a grade do eixo Y. */
function marcas(min: number, max: number, alvo = 4) {
  if (min === max) {
    min = Math.max(0, min - 5)
    max = max + 5
  }
  const bruto = (max - min) / alvo
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto
  const inicio = Math.floor(min / passo) * passo
  const fim = Math.ceil(max / passo) * passo
  const lista: number[] = []
  for (let v = inicio; v <= fim + passo / 2; v += passo) lista.push(Math.round(v * 100) / 100)
  return lista
}

/**
 * Evolução da maior carga por treino: uma série só (a cor da marca), linha de
 * 2px, marcadores de 8px com anel na cor da superfície, grade fina, valor
 * escrito na ponta e tooltip com linha vertical ao passar o dedo ou o mouse.
 */
export function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(320)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(240, e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cargas = pontos.map((p) => p.cargaMax)
  const ticks = marcas(Math.min(...cargas), Math.max(...cargas))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const areaL = largura - MARGEM.esquerda - MARGEM.direita
  const areaA = ALTURA - MARGEM.topo - MARGEM.base
  const x = (i: number) => MARGEM.esquerda + (pontos.length === 1 ? areaL / 2 : (i / (pontos.length - 1)) * areaL)
  const y = (v: number) => MARGEM.topo + areaA - ((v - yMin) / (yMax - yMin || 1)) * areaA
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cargaMax).toFixed(1)}`).join(' ')
  const ultimo = pontos.length - 1
  const anoDiferente = pontos.length > 1 && new Date(pontos[0].data).getFullYear() !== new Date(pontos[ultimo].data).getFullYear()

  function aoMover(clientX: number) {
    const ret = caixa.current!.getBoundingClientRect()
    const px = clientX - ret.left
    let melhor = 0
    pontos.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i
    })
    setAtivo(melhor)
  }

  const p = ativo !== null ? pontos[ativo] : null

  return (
    <figure className="grafico" aria-label="Evolução da maior carga por treino">
      <figcaption className="grafico-titulo">Maior carga por treino (kg)</figcaption>
      <div
        className="grafico-area"
        ref={caixa}
        onPointerMove={(e) => aoMover(e.clientX)}
        onPointerDown={(e) => aoMover(e.clientX)}
        onPointerLeave={() => setAtivo(null)}
      >
        <svg width={largura} height={ALTURA} role="img" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grafico-grade" x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(t)} y2={y(t)} />
              <text className="grafico-eixo" x={MARGEM.esquerda - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {t.toLocaleString('pt-BR')}
              </text>
            </g>
          ))}
          <text className="grafico-eixo" x={x(0)} y={ALTURA - 6} textAnchor={pontos.length === 1 ? 'middle' : 'start'}>
            {data(pontos[0].data, anoDiferente)}
          </text>
          {pontos.length > 1 && (
            <text className="grafico-eixo" x={x(ultimo)} y={ALTURA - 6} textAnchor="end">
              {data(pontos[ultimo].data, anoDiferente)}
            </text>
          )}
          {p && <line className="grafico-cruz" x1={x(ativo!)} x2={x(ativo!)} y1={MARGEM.topo} y2={MARGEM.topo + areaA} />}
          {pontos.length > 1 && <path className="grafico-linha" d={caminho} />}
          {pontos.map((pt, i) => (
            <circle key={pt.sessaoId} className="grafico-ponto" cx={x(i)} cy={y(pt.cargaMax)} r={i === ativo ? 6 : 4} />
          ))}
          <text className="grafico-rotulo" x={x(ultimo) + 10} y={y(pontos[ultimo].cargaMax)} dy="0.32em">
            {formatarPeso(pontos[ultimo].cargaMax)}
          </text>
        </svg>
        {p && (
          // Ao lado da linha vertical, no topo: nunca cobre o ponto nem a linha.
          <div
            className={`grafico-dica ${x(ativo!) > largura / 2 ? 'a-esquerda' : ''}`}
            style={{ left: x(ativo!) + (x(ativo!) > largura / 2 ? -10 : 10), top: MARGEM.topo }}
            role="status"
          >
            <strong>{data(p.data, true)}</strong>
            <span>
              {formatarPeso(p.cargaMax)} × {p.repsNaCargaMax}
            </span>
            <span className="sutil">Volume {formatarVolume(p.volume)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}
