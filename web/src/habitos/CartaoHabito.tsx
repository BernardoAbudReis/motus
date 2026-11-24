import type { CSSProperties } from 'react'
import { Icone, type NomeIcone } from '../components/Icone'
import type { Habito } from '../db'
import { formatarDuracao } from './cronometro'
import { corDoHabito } from './dados'
import { concluido, descreverFrequencia, descreverValor, progresso } from './logica'

const RAIO = 25
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

export function BotaoAnel({
  cor,
  fracao,
  icone,
  feito,
  rotulo,
  onClick,
}: {
  cor: string
  fracao: number
  icone: NomeIcone
  feito: boolean
  rotulo: string
  onClick: () => void
}) {
  return (
    <button
      className={`botao-anel ${feito ? 'feito' : ''}`}
      style={{ '--cor': cor } as CSSProperties}
      aria-label={rotulo}
      onClick={onClick}
    >
      <svg viewBox="0 0 60 60" aria-hidden>
        <circle className="anel-trilha" cx="30" cy="30" r={RAIO} />
        <circle
          className="anel-progresso"
          cx="30"
          cy="30"
          r={RAIO}
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - fracao)}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="anel-icone">
        <Icone nome={icone} tamanho={26} preenchido={icone === 'pausa'} />
      </span>
    </button>
  )
}

export function CartaoHabito({
  habito: h,
  valor,
  sequencia,
  cronometroSeg,
  onAcao,
  onAbrir,
}: {
  habito: Habito
  valor: number
  sequencia: number
  /** Segundos do cronômetro, se estiver rodando para este hábito. */
  cronometroSeg: number | null
  onAcao: () => void
  onAbrir: () => void
}) {
  const feito = concluido(h, valor)
  const rodando = cronometroSeg !== null
  const icone: NomeIcone = feito && h.meta.tipo === 'check' ? 'check' : h.meta.tipo === 'tempo' ? (rodando ? 'pausa' : 'play') : feito ? 'check' : 'mais'
  const detalhe = descreverValor(h.meta, valor)
  const rotulo =
    h.meta.tipo === 'check'
      ? feito
        ? `Desmarcar ${h.nome}`
        : `Marcar ${h.nome} como feito`
      : h.meta.tipo === 'tempo'
        ? rodando
          ? `Parar cronômetro de ${h.nome}`
          : `Iniciar cronômetro de ${h.nome}`
        : `Somar 1 em ${h.nome}`

  return (
    <article
      className={`cartao-habito ${feito ? 'feito' : ''} ${h.arquivado ? 'arquivado' : ''}`}
      style={{ '--cor': corDoHabito(h.cor) } as CSSProperties}
    >
      <button className="cartao-habito-corpo" onClick={onAbrir} aria-label={`Abrir ${h.nome}`}>
        <span className="habito-icone" aria-hidden>
          {h.icone}
        </span>
        <span className="habito-textos">
          {sequencia > 0 && (
            <span className="sequencia" title="Sequência de dias">
              <Icone nome="chama" tamanho={14} /> {sequencia}
            </span>
          )}
          <strong>{h.nome}</strong>
          <span className="habito-sub">
            {rodando ? (
              <span className="cronometro-rodando">⏱ {formatarDuracao(cronometroSeg)}</span>
            ) : (
              descreverFrequencia(h.frequencia)
            )}
            {detalhe && <>, {detalhe}</>}
          </span>
        </span>
      </button>
      <BotaoAnel
        cor={corDoHabito(h.cor)}
        fracao={progresso(h, valor)}
        icone={icone}
        feito={feito}
        rotulo={rotulo}
        onClick={onAcao}
      />
    </article>
  )
}
