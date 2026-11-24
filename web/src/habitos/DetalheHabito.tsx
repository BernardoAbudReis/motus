import { useState, type CSSProperties } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Habito } from '../db'
import { dataLocal } from '../repo'
import { formatarDuracao, iniciarCronometro, pararCronometro, useCronometro } from './cronometro'
import { arquivarHabito, corDoHabito, registrar, somar } from './dados'
import {
  agendadoNoDia,
  concluido,
  contarPeriodo,
  descreverFrequencia,
  descreverMeta,
  descreverValor,
  fimDoMes,
  inicioDaSemana,
  inicioDoMes,
  lerData,
  melhorSequencia,
  percentual,
  sequenciaAtual,
  somarDias,
  type ValoresPorData,
} from './logica'

const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

function rotuloDia(d: string, hoje: string) {
  if (d === hoje) return 'hoje'
  if (d === somarDias(hoje, -1)) return 'ontem'
  return lerData(d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Calendário do mês com o estado de cada dia. Tocar num dia passado permite corrigir o registro. */
function CalendarioMes({
  habito: h,
  valores,
  hoje,
  selecionado,
  onEscolher,
}: {
  habito: Habito
  valores: ValoresPorData
  hoje: string
  selecionado: string
  onEscolher: (d: string) => void
}) {
  const [mes, setMes] = useState(() => inicioDoMes(selecionado))
  const primeiro = lerData(mes)
  const deslocamento = (primeiro.getDay() + 6) % 7 // semana começa na segunda
  const ultimo = fimDoMes(mes)
  const dias: string[] = []
  for (let d = mes; d <= ultimo; d = somarDias(d, 1)) dias.push(d)

  const mudarMes = (n: number) => {
    const x = lerData(mes)
    setMes(dataLocal(new Date(x.getFullYear(), x.getMonth() + n, 1)))
  }

  return (
    <div className="calendario-mes">
      <div className="calendario-mes-topo">
        <button className="botao-icone" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
          <Icone nome="voltar" tamanho={20} />
        </button>
        <strong>{(() => { const t = primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) })()}</strong>
        <button className="botao-icone" aria-label="Próximo mês" onClick={() => mudarMes(1)} disabled={inicioDoMes(hoje) <= mes}>
          <Icone nome="avancar" tamanho={20} />
        </button>
      </div>
      <div className="calendario-mes-grade">
        {SEMANA.map((s, i) => (
          <span key={i} className="calendario-mes-cabecalho">
            {s}
          </span>
        ))}
        {Array.from({ length: deslocamento }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {dias.map((d) => {
          const valor = valores.get(d) ?? 0
          const agendado = agendadoNoDia(h, d, valores)
          const estado =
            d > hoje ? 'futuro' : concluido(h, valor) ? 'feito' : valor > 0 ? 'parcial' : agendado && d < hoje ? 'perdido' : agendado ? 'pendente' : 'fora'
          return (
            <button
              key={d}
              className={`dia-mes ${estado} ${d === selecionado ? 'selecionado' : ''}`}
              disabled={d > hoje}
              aria-label={`${lerData(d).toLocaleDateString('pt-BR')}: ${estado}`}
              aria-pressed={d === selecionado}
              onClick={() => onEscolher(d)}
            >
              {lerData(d).getDate()}
            </button>
          )
        })}
      </div>
      <div className="legenda">
        <span><i className="feito" /> Feito</span>
        <span><i className="parcial" /> Parcial</span>
        <span><i className="perdido" /> Não feito</span>
      </div>
    </div>
  )
}

function RegistroDoDia({ habito: h, dia, valor, hoje }: { habito: Habito; dia: string; valor: number; hoje: string }) {
  const { cron, segundos } = useCronometro()
  const rodandoAqui = cron?.habitoId === h.id
  const feito = concluido(h, valor)

  if (h.meta.tipo === 'check') {
    return (
      <button className={`botao largo ${feito ? '' : 'primario'}`} onClick={() => void registrar(h, dia, feito ? 0 : 1)}>
        {feito ? 'Desmarcar' : 'Marcar como feito'}
      </button>
    )
  }

  const passo = h.meta.tipo === 'tempo' ? 5 : 1
  const unidade = h.meta.tipo === 'tempo' ? 'min' : h.meta.unidade
  return (
    <>
      <div className="passador">
        <button className="botao" aria-label={`Menos ${passo}`} onClick={() => void somar(h, dia, -passo)} disabled={valor <= 0}>
          <Icone nome="menos" />
        </button>
        <label className="passador-valor">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={valor}
            aria-label={`Valor em ${unidade}`}
            onChange={(e) => void registrar(h, dia, Number(e.target.value) || 0)}
          />
          <span>{unidade}</span>
        </label>
        <button className="botao" aria-label={`Mais ${passo}`} onClick={() => void somar(h, dia, passo)}>
          <Icone nome="mais" />
        </button>
      </div>
      <p className="sutil centro">{descreverValor(h.meta, valor)}</p>
      {h.meta.tipo === 'tempo' && dia === hoje && (
        <button
          className={`botao largo ${rodandoAqui ? '' : 'primario'}`}
          onClick={() => void (rodandoAqui ? pararCronometro(h) : iniciarCronometro(h.id, dia))}
          disabled={!!cron && !rodandoAqui}
        >
          {rodandoAqui ? `Parar cronômetro (${formatarDuracao(segundos)})` : cron ? 'Outro cronômetro em andamento' : 'Iniciar cronômetro'}
        </button>
      )}
    </>
  )
}

export function DetalheHabito({
  habito: h,
  valores,
  diaInicial,
  hoje,
  onEditar,
  onFechar,
}: {
  habito: Habito
  valores: ValoresPorData
  diaInicial: string
  hoje: string
  onEditar: () => void
  onFechar: () => void
}) {
  const [dia, setDia] = useState(diaInicial)
  const semana = percentual(contarPeriodo([h], new Map([[h.id, valores]]), inicioDaSemana(hoje), hoje))
  const mes = percentual(contarPeriodo([h], new Map([[h.id, valores]]), inicioDoMes(hoje), hoje))

  return (
    <Folha titulo={h.nome} onFechar={onFechar}>
      <div className="detalhe-cabecalho" style={{ '--cor': corDoHabito(h.cor) } as CSSProperties}>
        <span className="habito-icone grande" aria-hidden>
          {h.icone}
        </span>
        <div>
          <p className="sutil">
            {descreverFrequencia(h.frequencia)} · {descreverMeta(h.meta)}
          </p>
          {h.arquivado && <p className="etiqueta">Arquivado</p>}
        </div>
      </div>

      <div className="grade-estatisticas">
        <div>
          <strong>{sequenciaAtual(h, valores, hoje)}</strong>
          <span>sequência atual</span>
        </div>
        <div>
          <strong>{melhorSequencia(h, valores, hoje)}</strong>
          <span>melhor sequência</span>
        </div>
        <div>
          <strong>{semana}%</strong>
          <span>nesta semana</span>
        </div>
        <div>
          <strong>{mes}%</strong>
          <span>neste mês</span>
        </div>
      </div>

      <section className="secao">
        <h3>Registro de {rotuloDia(dia, hoje)}</h3>
        <RegistroDoDia habito={h} dia={dia} valor={valores.get(dia) ?? 0} hoje={hoje} />
      </section>

      <section className="secao">
        <h3>Histórico</h3>
        <CalendarioMes habito={h} valores={valores} hoje={hoje} selecionado={dia} onEscolher={setDia} />
      </section>

      <div className="linha-botoes">
        <button className="botao" onClick={onEditar}>
          <Icone nome="editar" tamanho={18} /> Editar
        </button>
        <button
          className="botao"
          onClick={() => {
            void arquivarHabito(h.id, !h.arquivado)
            onFechar()
          }}
        >
          <Icone nome="arquivo" tamanho={18} /> {h.arquivado ? 'Desarquivar' : 'Arquivar'}
        </button>
      </div>
    </Folha>
  )
}
