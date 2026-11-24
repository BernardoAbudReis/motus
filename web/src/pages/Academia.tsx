import { useEffect, useState } from 'react'
import { Biblioteca } from '../academia/Biblioteca'
import { garantirBiblioteca, iniciarTreino, sessaoAtiva, useExercicios, useFichas, useSessoes } from '../academia/dados'
import { Execucao } from '../academia/Execucao'
import { FormFicha } from '../academia/FormFicha'
import { Historico } from '../academia/Historico'
import { finalizadas, inicioDaSemanaMs, resumir, treinosNoPeriodo } from '../academia/logica'
import { formatarDuracao } from '../habitos/cronometro'
import { Icone } from '../components/Icone'
import type { Exercicio, Ficha, SessaoTreino } from '../db'
import { DIAS_CURTOS, descreverFrequencia } from '../habitos/logica'

type Aba = 'treinar' | 'historico' | 'exercicios'

function haQuanto(ms: number) {
  const dias = Math.floor((Date.now() - ms) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

function CartaoFicha({
  ficha,
  ultimaVez,
  hoje,
  bloqueado,
  onIniciar,
  onEditar,
}: {
  ficha: Ficha
  ultimaVez: number | null
  hoje: boolean
  bloqueado: boolean
  onIniciar: () => void
  onEditar: () => void
}) {
  return (
    <article className={`cartao-ficha ${hoje ? 'hoje' : ''}`}>
      <button className="cartao-ficha-corpo" onClick={onEditar} aria-label={`Editar ${ficha.nome}`}>
        <span className="cartao-ficha-topo">
          <strong>{ficha.nome}</strong>
          {hoje && <span className="etiqueta destaque">Hoje</span>}
        </span>
        {ficha.descricao && <span className="sutil">{ficha.descricao}</span>}
        <span className="sutil">
          {ficha.itens.length} {ficha.itens.length === 1 ? 'exercício' : 'exercícios'}
          {ficha.diasSemana.length > 0 && ` · ${descreverFrequencia({ tipo: 'dias', dias: ficha.diasSemana })}`}
          {ultimaVez && ` · feito ${haQuanto(ultimaVez)}`}
        </span>
        {ficha.gruposMusculares.length > 0 && (
          <span className="chips pequenos">
            {ficha.gruposMusculares.map((g) => (
              <span key={g} className="chip">
                {g}
              </span>
            ))}
          </span>
        )}
      </button>
      <button className="botao primario" onClick={onIniciar} disabled={bloqueado}>
        Iniciar
      </button>
    </article>
  )
}

function CartaoAndamento({ sessao, onAbrir }: { sessao: SessaoTreino; onAbrir: () => void }) {
  const [agora, setAgora] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const r = resumir(sessao)
  return (
    <button className="cartao-andamento" onClick={onAbrir}>
      <span>
        <span className="sutil">Treino em andamento</span>
        <strong>{sessao.fichaNome}</strong>
        <span className="sutil">
          {formatarDuracao(Math.floor((agora - sessao.iniciadaEm) / 1000))} · {r.seriesFeitas}/{r.seriesTotal} séries
        </span>
      </span>
      <span className="botao primario">Continuar</span>
    </button>
  )
}

function Treinar({
  fichas,
  exercicios,
  sessoes,
  onAbrirTreino,
}: {
  fichas: Ficha[]
  exercicios: Exercicio[]
  sessoes: SessaoTreino[]
  onAbrirTreino: () => void
}) {
  const [form, setForm] = useState<{ ficha?: Ficha } | null>(null)
  const ativa = sessaoAtiva(sessoes)
  const diaHoje = new Date().getDay()
  const semana = treinosNoPeriodo(sessoes, inicioDaSemanaMs(), Date.now() + 1)
  const feitas = finalizadas(sessoes)
  const ultimaVez = (f: Ficha) => feitas.find((s) => s.fichaId === f.id)?.iniciadaEm ?? null
  const ordenadas = [...fichas].sort((a, b) => Number(b.diasSemana.includes(diaHoje)) - Number(a.diasSemana.includes(diaHoje)))

  async function iniciar(f: Ficha) {
    await iniciarTreino(f)
    onAbrirTreino()
  }

  return (
    <>
      {ativa && <CartaoAndamento sessao={ativa} onAbrir={onAbrirTreino} />}

      <div className="resumo dois">
        <div className="resumo-item">
          <span className="resumo-valor">{semana}</span>
          <span className="resumo-rotulo">{semana === 1 ? 'treino nesta semana' : 'treinos nesta semana'}</span>
        </div>
        <div className="resumo-item">
          <span className="resumo-valor">{feitas.length}</span>
          <span className="resumo-rotulo">treinos no total</span>
        </div>
      </div>

      <div className="titulo-secao">
        <h3>Fichas</h3>
        <button className="botao-link curto" onClick={() => setForm({})}>
          <Icone nome="mais" tamanho={18} /> Nova ficha
        </button>
      </div>

      {fichas.length === 0 ? (
        <div className="vazio">
          <span className="vazio-icone" aria-hidden>
            <Icone nome="academia" tamanho={30} />
          </span>
          <p className="vazio-titulo">Monte sua primeira ficha</p>
          <p>
            Escolha os exercícios, as séries, as repetições e o descanso. Hoje é {DIAS_CURTOS[diaHoje].replace('.', '').toLowerCase()}.
          </p>
          <button className="botao primario largo" onClick={() => setForm({})}>
            Criar ficha
          </button>
        </div>
      ) : (
        <div className="lista-fichas">
          {ordenadas.map((f) => (
            <CartaoFicha
              key={f.id}
              ficha={f}
              ultimaVez={ultimaVez(f)}
              hoje={f.diasSemana.includes(diaHoje)}
              bloqueado={!!ativa}
              onIniciar={() => void iniciar(f)}
              onEditar={() => setForm({ ficha: f })}
            />
          ))}
        </div>
      )}
      {ativa && fichas.length > 0 && <p className="sutil centro">Finalize o treino em andamento para iniciar outro.</p>}

      {form && <FormFicha ficha={form.ficha} exercicios={exercicios} onFechar={() => setForm(null)} />}
    </>
  )
}

export function Academia() {
  const [aba, setAba] = useState<Aba>('treinar')
  const [treinoAberto, setTreinoAberto] = useState(true)
  const exercicios = useExercicios()
  const fichas = useFichas()
  const sessoes = useSessoes()

  useEffect(() => {
    void garantirBiblioteca()
  }, [])

  if (!exercicios || !fichas || !sessoes) return null
  const ativa = sessaoAtiva(sessoes)

  return (
    <section>
      <header className="topo-pagina simples">
        <h1>Academia</h1>
      </header>
      <div className="alternador tres abas" role="tablist" aria-label="Seções da academia">
        {(
          [
            ['treinar', 'Treinar'],
            ['historico', 'Histórico'],
            ['exercicios', 'Exercícios'],
          ] as const
        ).map(([id, rotulo]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'treinar' && <Treinar fichas={fichas} exercicios={exercicios} sessoes={sessoes} onAbrirTreino={() => setTreinoAberto(true)} />}
      {aba === 'historico' && <Historico sessoes={sessoes} exercicios={exercicios} />}
      {aba === 'exercicios' && <Biblioteca exercicios={exercicios} sessoes={sessoes} />}

      {ativa && treinoAberto && <Execucao key={ativa.id} sessao={ativa} todasSessoes={sessoes} onMinimizar={() => setTreinoAberto(false)} />}
    </section>
  )
}
