import { useLiveQuery } from 'dexie-react-hooks'
import { Icone } from '../components/Icone'
import { db } from '../db'
import { formatarDuracao, pararCronometro, useCronometro } from './cronometro'

/** Barra flutuante acima da navegação enquanto um cronômetro de hábito está rodando, em qualquer aba. */
export function BarraCronometro() {
  const { cron, segundos } = useCronometro()
  const habito = useLiveQuery(async () => (cron ? db.habitos.get(cron.habitoId) : undefined), [cron?.habitoId])
  if (!cron || !habito) return null

  return (
    <div className="barra-cronometro" role="timer" aria-label={`Cronômetro de ${habito.nome}`}>
      <span className="barra-cronometro-icone" aria-hidden>
        {habito.icone}
      </span>
      <span className="barra-cronometro-nome">{habito.nome}</span>
      <strong className="barra-cronometro-tempo">{formatarDuracao(segundos)}</strong>
      <button className="barra-cronometro-parar" aria-label={`Parar cronômetro de ${habito.nome}`} onClick={() => void pararCronometro(habito)}>
        <Icone nome="parar" tamanho={16} />
      </button>
    </div>
  )
}
