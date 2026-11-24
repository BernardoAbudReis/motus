import { useState, type CSSProperties } from 'react'
import { useSessoes } from '../academia/dados'
import { GraficoEvolucao } from '../academia/GraficoEvolucao'
import { evolucao, finalizadas, formatarDuracaoLonga, formatarPeso, formatarVolume, numero, resumir } from '../academia/logica'
import { Icone } from '../components/Icone'
import { GraficoColunas, type Coluna } from '../estatisticas/GraficoColunas'
import {
  diasPerfeitos,
  exerciciosComHistorico,
  porHabito,
  porSemana,
  resumoTreinos,
  serieDiaria,
  somar,
  treinosPorSemana,
  type Periodo,
  type PontoDia,
} from '../estatisticas/logica'
import { corDoHabito, useHabitos, useValores } from '../habitos/dados'
import { DIAS_CURTOS, lerData, percentual, somarDias } from '../habitos/logica'
import { dataLocal } from '../repo'

const SEMANAS_ACADEMIA = 12

function dataCurta(d: string) {
  return lerData(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function dataLonga(d: string) {
  const t = lerData(d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Kpi({ valor, rotulo, detalhe }: { valor: string; rotulo: string; detalhe?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-valor">{valor}</span>
      <span className="kpi-rotulo">{rotulo}</span>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  )
}

function colunasHabitos(serie: PontoDia[], periodo: Periodo): Coluna[] {
  const pontos = periodo === 90 ? porSemana(serie) : serie
  return pontos.map((p) => {
    const pct = p.total ? percentual(p) : null
    const titulo = periodo === 90 ? `Semana de ${dataCurta(p.data)}` : dataLonga(p.data)
    return {
      chave: p.data,
      rotulo: periodo === 7 ? DIAS_CURTOS[lerData(p.data).getDay()].replace('.', '') : dataCurta(p.data),
      valor: pct,
      dica: p.total ? [titulo, `${p.feitos} de ${p.total} concluídos`, `${pct}%`] : [titulo, 'Nenhum hábito agendado'],
    }
  })
}

function SecaoHabitos({ periodo }: { periodo: Periodo }) {
  const habitos = useHabitos()
  const valores = useValores()
  if (!habitos) return null
  const ativos = habitos.filter((h) => !h.arquivado)

  if (ativos.length === 0) {
    return (
      <section className="secao-estat">
        <h2>Hábitos</h2>
        <p className="sutil">Crie hábitos na aba Hábitos para ver a consistência aqui.</p>
      </section>
    )
  }

  const hoje = dataLocal()
  const de = somarDias(hoje, -(periodo - 1))
  const serie = serieDiaria(ativos, valores, de, hoje)
  const total = somar(serie)
  const doDia = serie[serie.length - 1]
  const linhas = porHabito(ativos, valores, de, hoje)
  const maiorSequencia = linhas.reduce((m, l) => (l.sequencia > m.sequencia ? l : m), linhas[0])

  return (
    <section className="secao-estat">
      <h2>Hábitos</h2>
      <div className="kpis">
        <Kpi valor={`${doDia.feitos}/${doDia.total}`} rotulo="concluídos hoje" />
        <Kpi valor={`${percentual(total)}%`} rotulo="consistência" detalhe={`${total.feitos} de ${total.total} no período`} />
        <Kpi valor={String(diasPerfeitos(serie))} rotulo="dias perfeitos" detalhe="todos os agendados feitos" />
        <Kpi
          valor={`${maiorSequencia.sequencia} ${maiorSequencia.sequencia === 1 ? 'dia' : 'dias'}`}
          rotulo="maior sequência atual"
          detalhe={maiorSequencia.sequencia > 0 ? `${maiorSequencia.habito.icone} ${maiorSequencia.habito.nome}` : undefined}
        />
      </div>

      <GraficoColunas
        titulo={periodo === 90 ? 'Conclusão por semana (%)' : 'Conclusão por dia (%)'}
        colunas={colunasHabitos(serie, periodo)}
        maximo={100}
        marcas={[0, 50, 100]}
      />

      <table className="tabela tabela-habitos">
        <caption className="sr-only">Consistência por hábito no período</caption>
        <thead>
          <tr>
            <th scope="col">Hábito</th>
            <th scope="col">Consistência</th>
            <th scope="col" className="num">
              Sequência
            </th>
            <th scope="col" className="num">
              Melhor
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.habito.id}>
              <td>
                <span className="celula-habito">
                  <span aria-hidden>{l.habito.icone}</span> {l.habito.nome}
                </span>
              </td>
              <td>
                <span className="mini-barra" style={{ '--fracao': l.consistencia / 100, '--cor': corDoHabito(l.habito.cor) } as CSSProperties} aria-hidden />
                <span className="num-inline">{l.total ? `${l.consistencia}%` : '—'}</span>
              </td>
              <td className="num">
                {l.sequencia > 0 ? (
                  <span className="sequencia-celula">
                    <Icone nome="chama" tamanho={13} preenchido /> {l.sequencia}
                  </span>
                ) : (
                  '0'
                )}
              </td>
              <td className="num">{l.melhor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function SecaoAcademia({ periodo }: { periodo: Periodo }) {
  const sessoes = useSessoes()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  if (!sessoes) return null

  const feitas = finalizadas(sessoes)
  if (feitas.length === 0) {
    return (
      <section className="secao-estat">
        <h2>Academia</h2>
        <p className="sutil">Finalize um treino na aba Academia para ver frequência e evolução aqui.</p>
      </section>
    )
  }

  const hoje = dataLocal()
  const de = somarDias(hoje, -(periodo - 1))
  const r = resumoTreinos(sessoes, de, hoje)
  const semanas = treinosPorSemana(sessoes, SEMANAS_ACADEMIA, hoje)
  const maxSemana = Math.max(3, ...semanas.map((s) => s.quantidade))
  const exercicios = exerciciosComHistorico(sessoes)
  const exercicioId = escolhido && exercicios.some((e) => e.exercicioId === escolhido) ? escolhido : exercicios[0]?.exercicioId
  const pontos = exercicioId ? evolucao(exercicioId, sessoes) : []
  const recorde = pontos.reduce((m, p) => Math.max(m, p.cargaMax), 0)

  return (
    <section className="secao-estat">
      <h2>Academia</h2>
      <div className="kpis">
        <Kpi valor={String(r.quantidade)} rotulo={r.quantidade === 1 ? 'treino no período' : 'treinos no período'} />
        <Kpi valor={numero(r.quantidade / (periodo / 7))} rotulo="treinos por semana" detalhe="média do período" />
        <Kpi valor={formatarVolume(r.volume)} rotulo="volume levantado" detalhe={`${r.series} séries concluídas`} />
        <Kpi valor={r.quantidade ? formatarDuracaoLonga(r.duracaoMediaSeg) : '—'} rotulo="duração média" />
      </div>

      <GraficoColunas
        titulo={`Treinos por semana (últimas ${SEMANAS_ACADEMIA})`}
        colunas={semanas.map((s) => ({
          chave: s.inicio,
          rotulo: dataCurta(s.inicio),
          valor: s.quantidade,
          dica: [`Semana de ${dataCurta(s.inicio)}`, `${s.quantidade} ${s.quantidade === 1 ? 'treino' : 'treinos'}`],
        }))}
        maximo={maxSemana}
        marcas={[0, Math.round(maxSemana / 2), maxSemana]}
      />

      {exercicios.length > 0 && exercicioId && (
        <div className="bloco-estat">
          <div className="titulo-secao">
            <h3>Evolução de pesos</h3>
            <span className="sutil">recorde {formatarPeso(recorde)}</span>
          </div>
          <label className="sr-only" htmlFor="exercicio-evolucao">
            Exercício
          </label>
          <select id="exercicio-evolucao" value={exercicioId} onChange={(e) => setEscolhido(e.target.value)}>
            {exercicios.map((e) => (
              <option key={e.exercicioId} value={e.exercicioId}>
                {e.nome} ({e.treinos} {e.treinos === 1 ? 'treino' : 'treinos'})
              </option>
            ))}
          </select>
          <GraficoEvolucao key={exercicioId} pontos={pontos} />
        </div>
      )}

      <div className="bloco-estat">
        <h3>Histórico de desempenho</h3>
        <table className="tabela">
          <caption className="sr-only">Últimos treinos finalizados</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Treino</th>
              <th scope="col" className="num">
                Séries
              </th>
              <th scope="col" className="num">
                Volume
              </th>
            </tr>
          </thead>
          <tbody>
            {feitas.slice(0, 8).map((s) => {
              const rs = resumir(s)
              return (
                <tr key={s.id}>
                  <td>{dataCurta(dataLocal(new Date(s.iniciadaEm)))}</td>
                  <td>{s.fichaNome}</td>
                  <td className="num">{rs.seriesFeitas}</td>
                  <td className="num">{formatarVolume(rs.volume)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function Estatisticas() {
  const [periodo, setPeriodo] = useState<Periodo>(() => (Number(localStorage.getItem('motus-periodo')) as Periodo) || 30)

  function trocar(p: Periodo) {
    localStorage.setItem('motus-periodo', String(p))
    setPeriodo(p)
  }

  return (
    <section>
      <header className="topo-pagina simples">
        <h1>Estatísticas</h1>
      </header>
      <div className="alternador tres abas" role="radiogroup" aria-label="Período">
        {([7, 30, 90] as const).map((p) => (
          <button key={p} role="radio" aria-checked={periodo === p} className={periodo === p ? 'ativo' : ''} onClick={() => trocar(p)}>
            {p} dias
          </button>
        ))}
      </div>
      <SecaoHabitos periodo={periodo} />
      <SecaoAcademia periodo={periodo} />
    </section>
  )
}
