import { useEffect, useRef, useState } from 'react'

export interface Coluna {
  chave: string
  /** Rótulo curto do eixo X (mostrado só em parte das colunas quando há muitas). */
  rotulo: string
  /** null = sem dado (ex.: dia sem hábito agendado): não desenha a coluna. */
  valor: number | null
  /** Linhas do tooltip. */
  dica: string[]
}

const ALTURA = 170
const MARGEM = { topo: 14, direita: 8, base: 24, esquerda: 34 }

/**
 * Gráfico de colunas de uma série só, na cor da marca: colunas de até 24px,
 * topo arredondado (4px) e base reta, 2px de folga entre elas, grade fina e
 * tooltip ao tocar ou passar o mouse. A tabela com os mesmos dados fica
 * disponível para leitores de tela.
 */
export function GraficoColunas({
  titulo,
  colunas,
  maximo,
  marcas,
  formatarEixo = (v) => String(v),
}: {
  titulo: string
  colunas: Coluna[]
  maximo: number
  marcas: number[]
  formatarEixo?: (v: number) => string
}) {
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

  const areaL = largura - MARGEM.esquerda - MARGEM.direita
  const areaA = ALTURA - MARGEM.topo - MARGEM.base
  const faixa = areaL / Math.max(1, colunas.length)
  const espessura = Math.max(2, Math.min(24, faixa - 2))
  const y = (v: number) => MARGEM.topo + areaA - (Math.min(v, maximo) / (maximo || 1)) * areaA
  const base = MARGEM.topo + areaA
  // Rótulos do eixo X sem encavalar: no máximo ~7.
  const passoRotulo = Math.ceil(colunas.length / 7)

  function colunaPath(cx: number, v: number) {
    const topo = y(v)
    const h = base - topo
    if (h <= 0) return ''
    const r = Math.min(4, h, espessura / 2)
    const x0 = cx - espessura / 2
    const x1 = cx + espessura / 2
    return `M${x0},${base} L${x0},${topo + r} Q${x0},${topo} ${x0 + r},${topo} L${x1 - r},${topo} Q${x1},${topo} ${x1},${topo + r} L${x1},${base} Z`
  }

  function aoMover(clientX: number) {
    const ret = caixa.current!.getBoundingClientRect()
    const i = Math.floor((clientX - ret.left - MARGEM.esquerda) / faixa)
    setAtivo(i >= 0 && i < colunas.length ? i : null)
  }

  const c = ativo !== null ? colunas[ativo] : null
  const cxAtivo = ativo !== null ? MARGEM.esquerda + faixa * (ativo + 0.5) : 0

  return (
    <figure className="grafico">
      <figcaption className="grafico-titulo">{titulo}</figcaption>
      <div
        className="grafico-area"
        ref={caixa}
        onPointerMove={(e) => aoMover(e.clientX)}
        onPointerDown={(e) => aoMover(e.clientX)}
        onPointerLeave={() => setAtivo(null)}
      >
        <svg width={largura} height={ALTURA} aria-hidden>
          {marcas.map((m) => (
            <g key={m}>
              <line className="grafico-grade" x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} />
              <text className="grafico-eixo" x={MARGEM.esquerda - 8} y={y(m)} dy="0.32em" textAnchor="end">
                {formatarEixo(m)}
              </text>
            </g>
          ))}
          {colunas.map((col, i) => {
            const cx = MARGEM.esquerda + faixa * (i + 0.5)
            return (
              <g key={col.chave}>
                {col.valor !== null && col.valor > 0 && (
                  <path className={`grafico-coluna ${ativo !== null && ativo !== i ? 'apagada' : ''}`} d={colunaPath(cx, col.valor)} />
                )}
                {i % passoRotulo === 0 && (
                  <text className="grafico-eixo" x={cx} y={ALTURA - 6} textAnchor="middle">
                    {col.rotulo}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {c && (
          <div
            className={`grafico-dica ${cxAtivo > largura / 2 ? 'a-esquerda' : ''}`}
            style={{ left: cxAtivo + (cxAtivo > largura / 2 ? -14 : 14), top: MARGEM.topo }}
            role="status"
          >
            {c.dica.map((linha, i) => (i === 0 ? <strong key={i}>{linha}</strong> : <span key={i}>{linha}</span>))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>
          {colunas.map((col) => (
            <tr key={col.chave}>
              <td>{col.dica[0]}</td>
              <td>{col.dica.slice(1).join(', ') || 'sem dados'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
