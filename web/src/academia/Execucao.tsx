import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CampoNumero } from '../components/CampoNumero'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { SerieRealizada, SessaoTreino } from '../db'
import { formatarDuracao } from '../habitos/cronometro'
import { excluirTreino, finalizarTreino, modificarSessao } from './dados'
import { iniciarDescanso, pularDescanso, somarDescanso, useDescanso } from './descanso'
import { formatarDuracaoLonga, formatarPeso, formatarVolume, resumir, ultimoDesempenho } from './logica'

function useAgora(intervalo = 1000) {
  const [agora, setAgora] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(t)
  }, [intervalo])
  return agora
}

function BarraDescanso() {
  const d = useDescanso()
  if (!d) return null
  return (
    <div className="barra-descanso" role="timer" aria-live="polite" style={{ '--fracao': d.restante / d.total } as CSSProperties}>
      <div className="barra-descanso-texto">
        <span className="sutil">Descanso</span>
        <strong>{formatarDuracao(d.restante)}</strong>
      </div>
      <button className="botao" onClick={() => somarDescanso(-15)} aria-label="Menos 15 segundos">
        −15s
      </button>
      <button className="botao" onClick={() => somarDescanso(15)} aria-label="Mais 15 segundos">
        +15s
      </button>
      <button className="botao primario" onClick={pularDescanso}>
        Pular
      </button>
    </div>
  )
}

function Finalizar({ sessao, onFechar, onConcluido }: { sessao: SessaoTreino; onFechar: () => void; onConcluido: () => void }) {
  const [obs, setObs] = useState(sessao.observacoes)
  const r = resumir(sessao)
  const duracao = Math.round((Date.now() - sessao.iniciadaEm) / 1000)

  async function salvar() {
    if (r.seriesFeitas === 0 && !confirm('Nenhuma série foi concluída. Salvar mesmo assim?')) return
    pularDescanso()
    await finalizarTreino(sessao.id, obs.trim())
    onConcluido()
  }

  async function descartar() {
    if (!confirm('Descartar este treino? Nada dele será salvo.')) return
    pularDescanso()
    await excluirTreino(sessao.id)
    onConcluido()
  }

  return (
    <Folha titulo="Finalizar treino" onFechar={onFechar}>
      <div className="grade-estatisticas tres">
        <div>
          <strong>{formatarDuracaoLonga(duracao)}</strong>
          <span>duração</span>
        </div>
        <div>
          <strong>
            {r.seriesFeitas}/{r.seriesTotal}
          </strong>
          <span>séries</span>
        </div>
        <div>
          <strong>{formatarVolume(r.volume)}</strong>
          <span>volume</span>
        </div>
      </div>
      <label className="secao">
        Observações do treino
        <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Como foi? Dores, energia, ajustes…" maxLength={500} />
      </label>
      <button className="botao primario largo" onClick={() => void salvar()}>
        Salvar treino
      </button>
      <button className="botao-link perigo" onClick={() => void descartar()}>
        Descartar treino
      </button>
    </Folha>
  )
}

/** Tela cheia do treino em andamento. Cada alteração é gravada na hora. */
export function Execucao({
  sessao,
  todasSessoes,
  onMinimizar,
}: {
  sessao: SessaoTreino
  todasSessoes: SessaoTreino[]
  onMinimizar: () => void
}) {
  const primeiroPendente = sessao.exercicios.findIndex((e) => e.series.some((s) => !s.concluida))
  const [indice, setIndice] = useState(primeiroPendente < 0 ? 0 : primeiroPendente)
  const [finalizando, setFinalizando] = useState(false)
  const agora = useAgora()
  const ex = sessao.exercicios[indice]
  const anterior = useMemo(() => (ex ? ultimoDesempenho(ex.exercicioId, todasSessoes) : null), [ex, todasSessoes])

  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  function mudarSerie(i: number, campos: Partial<SerieRealizada>) {
    const exIndice = indice
    return modificarSessao(sessao.id, (s) => ({
      exercicios: s.exercicios.map((e, ei) =>
        ei !== exIndice ? e : { ...e, series: e.series.map((x, si) => (si === i ? { ...x, ...campos } : x)) },
      ),
    }))
  }

  function alternarConcluida(i: number) {
    const concluir = !ex.series[i].concluida
    void mudarSerie(i, { concluida: concluir })
    if (concluir) iniciarDescanso(ex.descansoSeg, ex.nome)
    else pularDescanso()
  }

  function adicionarSerie() {
    const exIndice = indice
    void modificarSessao(sessao.id, (s) => ({
      exercicios: s.exercicios.map((e, ei) => {
        if (ei !== exIndice) return e
        const ultima = e.series[e.series.length - 1]
        return { ...e, series: [...e.series, { peso: ultima?.peso ?? 0, repeticoes: ultima?.repeticoes ?? e.repeticoesPlanejadas, concluida: false }] }
      }),
    }))
  }

  function removerSerie() {
    const exIndice = indice
    void modificarSessao(sessao.id, (s) => ({
      exercicios: s.exercicios.map((e, ei) => (ei !== exIndice || e.series.length <= 1 ? e : { ...e, series: e.series.slice(0, -1) })),
    }))
  }

  const r = resumir(sessao)
  const exercicioCompleto = ex?.series.every((s) => s.concluida)

  return createPortal(
    <div className="execucao" role="dialog" aria-modal="true" aria-label={`Treino ${sessao.fichaNome}`}>
      <header className="execucao-topo">
        <button className="botao-redondo" aria-label="Minimizar treino" onClick={onMinimizar}>
          <Icone nome="minimizar" tamanho={22} />
        </button>
        <div className="execucao-titulo">
          <strong>{sessao.fichaNome}</strong>
          <span className="sutil">
            <Icone nome="relogio" tamanho={14} /> {formatarDuracao(Math.max(0, Math.floor((agora - sessao.iniciadaEm) / 1000)))} · {r.seriesFeitas}/{r.seriesTotal} séries
          </span>
        </div>
        <button className="botao primario" onClick={() => setFinalizando(true)}>
          Finalizar
        </button>
      </header>

      <div className="barra-progresso" style={{ '--fracao': r.seriesTotal ? r.seriesFeitas / r.seriesTotal : 0 } as CSSProperties} aria-hidden />

      <nav className="execucao-exercicios" aria-label="Exercícios do treino">
        {sessao.exercicios.map((e, i) => {
          const feitas = e.series.filter((s) => s.concluida).length
          return (
            <button
              key={i}
              className={`chip ${i === indice ? 'ativo' : ''} ${feitas === e.series.length ? 'completo' : ''}`}
              aria-current={i === indice ? 'step' : undefined}
              onClick={() => setIndice(i)}
            >
              {feitas === e.series.length && <Icone nome="check" tamanho={14} />} {e.nome}
            </button>
          )
        })}
      </nav>

      {ex && (
        <main className="execucao-corpo">
          <p className="sutil">
            Exercício {indice + 1} de {sessao.exercicios.length} · {ex.grupoMuscular}
            {ex.equipamento && ` · ${ex.equipamento}`}
          </p>
          <h1 className="execucao-nome">{ex.nome}</h1>
          <p className="sutil">
            Meta: {ex.series.length} × {ex.repeticoesPlanejadas} · descanso {ex.descansoSeg}s
          </p>
          {ex.observacoes && <p className="observacao">{ex.observacoes}</p>}
          {anterior && (
            <p className="anterior">
              Última vez: {anterior.map((s) => `${formatarPeso(s.peso)} × ${s.repeticoes}`).join(' · ')}
            </p>
          )}

          <div className="series">
            <div className="series-cabecalho" aria-hidden>
              <span>Série</span>
              <span>Peso</span>
              <span>Reps</span>
              <span />
            </div>
            {ex.series.map((s, i) => (
              <div key={i} className={`serie ${s.concluida ? 'concluida' : ''}`}>
                <span className="serie-numero">{i + 1}</span>
                <CampoNumero valor={s.peso} rotulo={`Peso da série ${i + 1}`} sufixo="kg" onMudar={(n) => void mudarSerie(i, { peso: n })} />
                <CampoNumero valor={s.repeticoes} inteiro rotulo={`Repetições da série ${i + 1}`} onMudar={(n) => void mudarSerie(i, { repeticoes: n })} />
                <button
                  className="serie-check"
                  aria-label={s.concluida ? `Desfazer série ${i + 1}` : `Concluir série ${i + 1}`}
                  aria-pressed={s.concluida}
                  onClick={() => alternarConcluida(i)}
                >
                  <Icone nome="check" tamanho={22} />
                </button>
              </div>
            ))}
            <div className="linha-botoes">
              <button className="botao" onClick={adicionarSerie}>
                <Icone nome="mais" tamanho={18} /> Série
              </button>
              <button className="botao" onClick={removerSerie} disabled={ex.series.length <= 1}>
                <Icone nome="menos" tamanho={18} /> Série
              </button>
            </div>
          </div>
        </main>
      )}

      <footer className="execucao-rodape">
        <BarraDescanso />
        <div className="execucao-navegacao">
          <button className="botao" disabled={indice === 0} onClick={() => setIndice(indice - 1)}>
            <Icone nome="voltar" tamanho={18} /> Anterior
          </button>
          {indice < sessao.exercicios.length - 1 ? (
            <button className={`botao ${exercicioCompleto ? 'primario' : ''}`} onClick={() => setIndice(indice + 1)}>
              Próximo <Icone nome="avancar" tamanho={18} />
            </button>
          ) : (
            <button className={`botao ${exercicioCompleto ? 'primario' : ''}`} onClick={() => setFinalizando(true)}>
              Finalizar treino
            </button>
          )}
        </div>
      </footer>

      {finalizando && <Finalizar sessao={sessao} onFechar={() => setFinalizando(false)} onConcluido={onMinimizar} />}
    </div>,
    document.body,
  )
}
