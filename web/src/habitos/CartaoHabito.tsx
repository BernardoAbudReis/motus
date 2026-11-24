import type { CSSProperties } from 'react'
import { Icone, type NomeIcone } from '../components/Icone'
import type { Habito } from '../db'
import { formatarDuracao } from './cronometro'
import { corDoHabito } from './dados'
import { concluido, descreverFrequencia, descreverValor, progresso } from './logica'

const RAIO = 25
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

/** Botão redondo com anel de progresso. Concluído: círculo claro com o check na cor do hábito. */
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
  const solido = icone === 'play' || icone === 'pausa' || icone === 'parar'
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
      {/* Ícones sólidos são menores para ter o mesmo peso visual do + e do check. */}
      <span className={`anel-icone ${icone === 'play' ? 'ajuste-play' : ''}`}>
        <Icone nome={icone} tamanho={solido ? 20 : 28} espessura={feito ? 3 : 2.4} />
      </span>
    </button>
  )
}

export function CartaoHabito({
  habito: h,
  valor,
  sequencia,
  semFazer,
  foraDoDia = false,
  cronometroSeg,
  onAcao,
  onAbrir,
}: {
  habito: Habito
  valor: number
  sequencia: number
  /** Dias agendados seguidos sem fazer (mostrado como −N quando não há sequência). */
  semFazer: number
  /** Hábito não agendado neste dia (aparece só com "mostrar todos"). */
  foraDoDia?: boolean
  /** Segundos do cronômetro, se estiver rodando para este hábito. */
  cronometroSeg: number | null
  onAcao: () => void
  onAbrir: () => void
}) {
  const feito = concluido(h, valor)
  const rodando = cronometroSeg !== null
  const fracao = progresso(h, valor)
  const icone: NomeIcone = feito ? 'check' : h.meta.tipo === 'tempo' ? (rodando ? 'parar' : 'play') : 'mais'
  const valorTexto = descreverValor(h.meta, valor)
  const detalhe = rodando ? `${formatarDuracao(cronometroSeg)} · ${valorTexto}` : valorTexto
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
      className={`cartao-habito ${feito ? 'feito' : ''} ${h.arquivado ? 'arquivado' : ''} ${foraDoDia ? 'fora-do-dia' : ''}`}
      style={{ '--cor': corDoHabito(h.cor), '--fracao': fracao } as CSSProperties}
    >
      <button className="cartao-habito-corpo" onClick={onAbrir} aria-label={`Abrir ${h.nome}`}>
        {sequencia > 0 ? (
          <span className="contador sequencia" title={`Sequência de ${sequencia} dias`}>
            <Icone nome="chama" tamanho={15} preenchido /> {sequencia}
          </span>
        ) : semFazer > 0 ? (
          <span className="contador sem-fazer" title={`${semFazer} dias agendados sem fazer`}>
            −{semFazer}
          </span>
        ) : null}
        <span className="habito-linha">
          <span className="habito-icone" aria-hidden>
            {h.icone}
          </span>
          <span className="habito-textos">
            <strong>{h.nome}</strong>
            <span className="habito-sub">
              {foraDoDia ? 'Não agendado neste dia' : descreverFrequencia(h.frequencia)}
              {detalhe && <>, {detalhe}</>}
            </span>
          </span>
        </span>
      </button>
      <BotaoAnel cor={corDoHabito(h.cor)} fracao={fracao} icone={icone} feito={feito} rotulo={rotulo} onClick={onAcao} />
      {rodando && (
        <span className="selo-cronometro" aria-hidden>
          <Icone nome="cronometro" tamanho={14} />
        </span>
      )}
    </article>
  )
}
