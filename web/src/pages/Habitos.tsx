import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import type { Habito } from '../db'
import { CartaoHabito } from '../habitos/CartaoHabito'
import { iniciarCronometro, pararCronometro, useCronometro } from '../habitos/cronometro'
import { acaoRapida, criarExemplos, useHabitos, useValores } from '../habitos/dados'
import { DetalheHabito } from '../habitos/DetalheHabito'
import { FormHabito } from '../habitos/FormHabito'
import {
  DIAS_CURTOS,
  previstoPelaFrequencia,
  contarPeriodo,
  diasSemFazer,
  lerData,
  sequenciaAtual,
  somarDias,
} from '../habitos/logica'
import { dataLocal } from '../repo'

const DIAS_NO_CALENDARIO = 28

/** Hoje, atualizado quando vira o dia com o app aberto. */
function useHoje() {
  const [hoje, setHoje] = useState(dataLocal)
  useEffect(() => {
    const t = setInterval(() => setHoje(dataLocal()), 60_000)
    const aoVoltar = () => setHoje(dataLocal())
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])
  return hoje
}

function tituloDoDia(dia: string, hoje: string) {
  if (dia === hoje) return 'Hoje'
  if (dia === somarDias(hoje, -1)) return 'Ontem'
  const t = lerData(dia).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Faixa de dias rolável, terminando em amanhã (desabilitado), como uma agenda. */
function CalendarioHorizontal({
  dia,
  hoje,
  fracaoDoDia,
  onEscolher,
}: {
  dia: string
  hoje: string
  fracaoDoDia: (d: string) => number | null
  onEscolher: (d: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dias = Array.from({ length: DIAS_NO_CALENDARIO }, (_, i) => somarDias(hoje, i - DIAS_NO_CALENDARIO + 2))

  useLayoutEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [dia])

  return (
    <div className="calendario-horizontal" ref={ref} role="tablist" aria-label="Escolher dia">
      {dias.map((d) => {
        const futuro = d > hoje
        const fracao = futuro ? null : fracaoDoDia(d)
        return (
          <button
            key={d}
            role="tab"
            aria-selected={d === dia}
            disabled={futuro}
            className={`dia ${d === dia ? 'ativo' : ''} ${futuro ? 'futuro' : ''}`}
            onClick={() => onEscolher(d)}
          >
            <span className="dia-semana">{DIAS_CURTOS[lerData(d).getDay()]}</span>
            <span className="dia-numero" style={{ '--fracao': fracao ?? 0 } as CSSProperties} data-completo={fracao === 1 || undefined}>
              {lerData(d).getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Habitos() {
  const hoje = useHoje()
  const [dia, setDia] = useState(hoje)
  const [verArquivados, setVerArquivados] = useState(false)
  const [mostrarTodos, setMostrarTodos] = useState(() => localStorage.getItem('motus-mostrar-todos') === '1')
  const [form, setForm] = useState<{ habito?: Habito } | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const habitos = useHabitos()
  const valores = useValores()
  const { cron, segundos } = useCronometro()

  // Se virou o dia com o app aberto e o usuário estava em "hoje", acompanha.
  const hojeAnterior = useRef(hoje)
  useEffect(() => {
    const anterior = hojeAnterior.current
    setDia((d) => (d === anterior ? hoje : d))
    hojeAnterior.current = hoje
  }, [hoje])

  if (!habitos) return null

  const ativos = habitos.filter((h) => !h.arquivado)
  const arquivados = habitos.filter((h) => h.arquivado)
  // Agendados do dia primeiro; com "mostrar todos", os demais vêm depois, esmaecidos.
  const doDia = ativos.filter((h) => previstoPelaFrequencia(h, dia))
  const foraDoDia = mostrarTodos ? ativos.filter((h) => !previstoPelaFrequencia(h, dia)) : []
  const lista = verArquivados ? arquivados : [...doDia, ...foraDoDia]
  const vazio = (h: Habito) => valores.get(h.id) ?? new Map<string, number>()
  const aberto = habitos.find((h) => h.id === abertoId)

  function fracaoDoDia(d: string) {
    const c = contarPeriodo(ativos, valores, d, d)
    return c.total === 0 ? null : c.feitos / c.total
  }

  function acao(h: Habito) {
    if (h.meta.tipo !== 'tempo') return void acaoRapida(h, dia)
    if (cron?.habitoId === h.id) return void pararCronometro(h)
    if (cron) return setAbertoId(h.id) // já há outro cronômetro: abre o detalhe para ajustar à mão
    if (dia !== hoje) return setAbertoId(h.id) // dia passado: registrar tempo à mão
    iniciarCronometro(h.id, dia)
  }

  return (
    <section>
      <header className="topo-pagina">
        <div className="grupo-botoes">
          <button
            className={verArquivados ? 'ativo' : ''}
            aria-label={verArquivados ? 'Voltar para os hábitos' : 'Ver arquivados'}
            aria-pressed={verArquivados}
            onClick={() => setVerArquivados(!verArquivados)}
          >
            <Icone nome={verArquivados ? 'voltar' : 'arquivo'} tamanho={20} />
          </button>
          <button
            className={mostrarTodos ? 'ativo' : ''}
            aria-label={mostrarTodos ? 'Mostrar só os agendados do dia' : 'Mostrar todos os hábitos'}
            aria-pressed={mostrarTodos}
            disabled={verArquivados}
            onClick={() => {
              localStorage.setItem('motus-mostrar-todos', mostrarTodos ? '0' : '1')
              setMostrarTodos(!mostrarTodos)
            }}
          >
            <Icone nome={mostrarTodos ? 'ver' : 'ocultar'} tamanho={20} />
          </button>
        </div>
        <h1>{verArquivados ? 'Arquivados' : tituloDoDia(dia, hoje)}</h1>
        <button className="botao-redondo" aria-label="Novo hábito" onClick={() => setForm({})}>
          <Icone nome="mais" tamanho={22} />
        </button>
      </header>

      {!verArquivados && (
        <>
          <CalendarioHorizontal dia={dia} hoje={hoje} fracaoDoDia={fracaoDoDia} onEscolher={setDia} />
        </>
      )}

      {lista.length > 0 && (
        <div className="lista-habitos">
          {lista.map((h) => (
            <CartaoHabito
              key={h.id}
              habito={h}
              valor={vazio(h).get(dia) ?? 0}
              sequencia={sequenciaAtual(h, vazio(h), dia)}
              semFazer={diasSemFazer(h, vazio(h), dia)}
              foraDoDia={!verArquivados && !previstoPelaFrequencia(h, dia)}
              cronometroSeg={cron?.habitoId === h.id ? segundos : null}
              onAcao={() => acao(h)}
              onAbrir={() => setAbertoId(h.id)}
            />
          ))}
        </div>
      )}

      {lista.length === 0 && (
        <div className="vazio">
          {verArquivados ? (
            <p>Nenhum hábito arquivado.</p>
          ) : habitos.length === 0 ? (
            <>
              <span className="vazio-icone" aria-hidden>
                <Icone nome="habitos" tamanho={30} />
              </span>
              <p className="vazio-titulo">Comece pelo primeiro hábito</p>
              <p>Pequenas ações repetidas todo dia levam à evolução.</p>
              <button className="botao primario largo" onClick={() => setForm({})}>
                Criar hábito
              </button>
              <button className="botao-link" onClick={() => void criarExemplos()}>
                Adicionar exemplos (estudar, ler, creatina, boxe, cama)
              </button>
            </>
          ) : (
            <p>Nenhum hábito agendado para este dia.</p>
          )}
        </div>
      )}

      {aberto && (
        <DetalheHabito
          key={aberto.id}
          habito={aberto}
          valores={vazio(aberto)}
          diaInicial={dia}
          hoje={hoje}
          onFechar={() => setAbertoId(null)}
          onEditar={() => {
            setAbertoId(null)
            setForm({ habito: aberto })
          }}
        />
      )}
      {form && <FormHabito habito={form.habito} onFechar={() => setForm(null)} />}
    </section>
  )
}
