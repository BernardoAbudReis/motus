import { useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { ListaAtividades, Numero, Secao } from './comum'
import { ROTULO_TIPO, useAcoes } from './contexto'
import { CartaoMateria } from './Materias'
import {
  atrasadas,
  dataCurta,
  descreverSemana,
  diasDaSemana,
  doDia,
  formatarMinutos,
  inicioDaSemana,
  lerData,
  materiasDoSetor,
  nomeDoDia,
  percentual,
  resumirSemana,
  separarRevisoes,
  somarDias,
  type ResumoSemana,
} from './logica'


/* ---------- Hoje (dashboard) ---------- */

export function Hoje({ onIrPara }: { onIrPara: (aba: 'semana' | 'revisoes' | 'materias') => void }) {
  const { dados, hoje, indices, planejar, registrar, abrirMateria } = useAcoes()
  const atrasos = atrasadas(dados.atividades, hoje)
  const deHoje = doDia(dados.atividades, hoje)
  const feitasHoje = deHoje.filter((a) => a.estado === 'feita').length
  const estudosHoje = deHoje.filter((a) => a.tipo === 'estudo')
  const revisoesHoje = deHoje.filter((a) => a.tipo === 'revisao')
  const semana = resumirSemana(dados.atividades, dados.sessoes, inicioDaSemana(hoje), hoje)
  const rev = separarRevisoes(dados.atividades, hoje)
  const materias = materiasDoSetor(dados.materias, null)
  const proximos = [1, 2, 3, 4, 5, 6].map((n) => somarDias(hoje, n)).filter((d) => d <= somarDias(inicioDaSemana(hoje), 6))
  const avulsasHoje = dados.sessoes.filter((s) => s.data === hoje && !s.atividadeId)
  const conteudos = dados.conteudos.filter((c) => indices.materia.get(c.materiaId) && !indices.materia.get(c.materiaId)!.arquivada)
  const contar = (s: string) => conteudos.filter((c) => c.status === s).length
  const minutosTotal = dados.sessoes.reduce((t, s) => t + (s.minutos ?? 0), 0)
  const pctHoje = percentual(feitasHoje, deHoje.length)

  return (
    <>
      <div className="cartao-dia-estudos" style={{ '--fracao': pctHoje / 100 } as CSSProperties}>
        <div>
          <strong>
            {deHoje.length === 0 ? 'Nada planejado para hoje' : `${feitasHoje} de ${deHoje.length} ${deHoje.length === 1 ? 'atividade feita' : 'atividades feitas'}`}
          </strong>
          <span className="sutil">
            {estudosHoje.length} {estudosHoje.length === 1 ? 'estudo' : 'estudos'} · {revisoesHoje.length} {revisoesHoje.length === 1 ? 'revisão' : 'revisões'}
            {atrasos.length > 0 && ` · ${atrasos.length} ${atrasos.length === 1 ? 'atrasada' : 'atrasadas'}`}
          </span>
        </div>
        <span className="pct-dia">{pctHoje}%</span>
        <span className="barra" />
      </div>

      <div className="linha-botoes duas">
        <button className="botao primario" onClick={() => planejar()}>
          <Icone nome="mais" tamanho={18} /> Planejar
        </button>
        <button className="botao" onClick={() => registrar()}>
          <Icone nome="check" tamanho={18} /> Registrar estudo
        </button>
      </div>

      {atrasos.length > 0 && (
        <Secao titulo="Atrasadas">
          <p className="sutil dica">Continuam pendentes até você concluir, reagendar ou remover. Toque para ver as opções.</p>
          <ListaAtividades atividades={atrasos} />
        </Secao>
      )}

      <Secao titulo="Hoje">
        <ListaAtividades atividades={deHoje} vazio="Use Planejar para montar o dia." />
        {avulsasHoje.length > 0 && (
          <p className="sutil">
            Também registrado hoje: {avulsasHoje.map((s) => `${indices.conteudo.get(s.conteudoId)?.nome ?? '—'} (${ROTULO_TIPO[s.tipo].toLowerCase()})`).join(', ')}
          </p>
        )}
      </Secao>

      <Secao
        titulo="Esta semana"
        acao={
          <button className="botao-link curto" onClick={() => onIrPara('semana')}>
            Ver semana <Icone nome="avancar" tamanho={16} />
          </button>
        }
      >
        <ResumoDaSemana r={semana} />
        {proximos.length > 0 && (
          <ul className="proximos-dias">
            {proximos.map((d) => {
              const ativs = doDia(dados.atividades, d)
              return (
                <li key={d}>
                  <span className="proximos-dia">{nomeDoDia(d, hoje)}</span>
                  <span className="sutil">
                    {ativs.length === 0 ? 'livre' : ativs.map((a) => indices.conteudo.get(a.conteudoId)?.nome ?? '—').join(', ')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Revisões"
        acao={
          <button className="botao-link curto" onClick={() => onIrPara('revisoes')}>
            Ver revisões <Icone nome="avancar" tamanho={16} />
          </button>
        }
      >
        <div className="resumo">
          <Numero valor={rev.hoje.length} rotulo="para hoje" />
          <Numero valor={rev.atrasadas.length} rotulo="atrasadas" />
          <Numero valor={rev.proximas.length} rotulo="próximas" />
        </div>
      </Secao>

      <Secao titulo="Progresso geral">
        <div className="resumo quatro">
          <Numero valor={materias.length} rotulo="matérias" />
          <Numero valor={conteudos.length} rotulo="conteúdos" />
          <Numero valor={contar('concluido')} rotulo="concluídos" />
          <Numero valor={contar('andamento')} rotulo="em andamento" />
          <Numero valor={contar('pendente')} rotulo="pendentes" />
          <Numero valor={dados.sessoes.filter((s) => s.tipo === 'revisao').length} rotulo="revisões feitas" />
          <Numero valor={minutosTotal ? formatarMinutos(minutosTotal) : '—'} rotulo="de estudo" />
          <Numero valor={dados.sessoes.length} rotulo="registros" />
        </div>
      </Secao>

      <Secao
        titulo="Por matéria"
        acao={
          <button className="botao-link curto" onClick={() => onIrPara('materias')}>
            Matérias <Icone nome="avancar" tamanho={16} />
          </button>
        }
      >
        <div className="lista-materias">
          {materias.map((m) => (
            <CartaoMateria key={m.id} materia={m} onAbrir={() => abrirMateria(m.id)} />
          ))}
        </div>
      </Secao>
    </>
  )
}

function ResumoDaSemana({ r, passada }: { r: ResumoSemana; passada?: boolean }) {
  return (
    <>
      <div className="resumo quatro">
        <Numero valor={r.planejadas} rotulo="planejadas" />
        <Numero valor={r.feitas} rotulo="concluídas" />
        <Numero valor={r.pendentes} rotulo={passada ? 'não realizadas' : 'pendentes'} />
        <Numero valor={`${r.percentual}%`} rotulo="execução" />
      </div>
      <p className="sutil linha-resumo">
        {r.conteudosEstudados} {r.conteudosEstudados === 1 ? 'conteúdo estudado' : 'conteúdos estudados'} · {r.revisoesFeitas}{' '}
        {r.revisoesFeitas === 1 ? 'revisão feita' : 'revisões feitas'}
        {r.minutos > 0 && ` · ${formatarMinutos(r.minutos)}`}
        {r.reagendadas.length > 0 && ` · ${r.reagendadas.length} reagendada${r.reagendadas.length > 1 ? 's' : ''}`}
        {r.removidas > 0 && ` · ${r.removidas} removida${r.removidas > 1 ? 's' : ''}`}
      </p>
    </>
  )
}

/* ---------- Semana (planejamento e histórico) ---------- */

const DIAS_PILULA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function Semana() {
  const { dados, hoje, indices, planejar } = useAcoes()
  const [inicio, setInicio] = useState(() => inicioDaSemana(hoje))
  const [modo, setModo] = useState<'dia' | 'semana'>('dia')
  const [diaEscolhido, setDiaEscolhido] = useState(hoje)
  const dias = diasDaSemana(inicio)
  const dia = dias.includes(diaEscolhido) ? diaEscolhido : dias[0]
  const r = resumirSemana(dados.atividades, dados.sessoes, inicio, hoje)
  const passada = somarDias(inicio, 6) < hoje
  const mostrar = modo === 'dia' ? [dia] : dias

  function mudarSemana(n: number) {
    const novo = somarDias(inicio, n * 7)
    setInicio(novo)
    setDiaEscolhido(novo === inicioDaSemana(hoje) ? hoje : novo)
  }

  return (
    <>
      <div className="navegacao-semana">
        <button className="botao-redondo" aria-label="Semana anterior" onClick={() => mudarSemana(-1)}>
          <Icone nome="voltar" tamanho={20} />
        </button>
        <div className="centro">
          <strong>{descreverSemana(inicio, hoje)}</strong>
          <span className="sutil bloco">
            {dataCurta(inicio)} a {dataCurta(dias[6])}
          </span>
        </div>
        <button className="botao-redondo" aria-label="Próxima semana" onClick={() => mudarSemana(1)}>
          <Icone nome="avancar" tamanho={20} />
        </button>
      </div>

      <ResumoDaSemana r={r} passada={passada} />

      <div className="alternador" role="radiogroup" aria-label="Visualização">
        {(
          [
            ['dia', 'Dia'],
            ['semana', 'Semana inteira'],
          ] as const
        ).map(([id, rotulo]) => (
          <button key={id} type="button" role="radio" aria-checked={modo === id} className={modo === id ? 'ativo' : ''} onClick={() => setModo(id)}>
            {rotulo}
          </button>
        ))}
      </div>

      {modo === 'dia' && (
        <div className="pilulas-dias" role="tablist" aria-label="Dia da semana">
          {dias.map((d, i) => {
            const n = doDia(dados.atividades, d).length
            return (
              <button key={d} role="tab" aria-selected={d === dia} className={`${d === dia ? 'ativo' : ''} ${d === hoje ? 'hoje' : ''}`} onClick={() => setDiaEscolhido(d)}>
                <span>{DIAS_PILULA[i]}</span>
                <strong>{lerData(d).getDate()}</strong>
                <span className="pontos" aria-label={`${n} atividades`}>
                  {n > 0 ? '•'.repeat(Math.min(n, 3)) : ' '}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className={modo === 'semana' ? 'grade-semana' : ''}>
        {mostrar.map((d) => {
          const ativs = doDia(dados.atividades, d)
          const removidas = dados.atividades.filter((a) => a.data === d && a.estado === 'removida')
          const avulsas = dados.sessoes.filter((s) => s.data === d && !s.atividadeId)
          return (
            <section key={d} className="dia-planejamento">
              <div className="titulo-secao">
                <h3>{nomeDoDia(d, hoje)}</h3>
                <button className="botao-link curto" aria-label={`Planejar em ${nomeDoDia(d, hoje)}`} onClick={() => planejar({ data: d })}>
                  <Icone nome="mais" tamanho={18} /> Adicionar
                </button>
              </div>
              <ListaAtividades atividades={[...ativs, ...removidas]} vazio="Nada planejado." />
              {avulsas.length > 0 && (
                <p className="sutil">
                  Sem planejamento: {avulsas.map((s) => `${indices.conteudo.get(s.conteudoId)?.nome ?? '—'} (${ROTULO_TIPO[s.tipo].toLowerCase()})`).join(', ')}
                </p>
              )}
            </section>
          )
        })}
      </div>

      {r.reagendadas.length > 0 && (
        <Secao titulo="Reagendadas nesta semana">
          <ul className="lista-simples">
            {r.reagendadas.map((a) => {
              const ultimo = [...a.reagendamentos].reverse().find((x) => dias.includes(x.de))!
              return (
                <li key={a.id}>
                  {indices.conteudo.get(a.conteudoId)?.nome ?? '—'}: {dataCurta(ultimo.de)} → {dataCurta(ultimo.para)}
                </li>
              )
            })}
          </ul>
        </Secao>
      )}
    </>
  )
}

/* ---------- Revisões ---------- */

export function Revisoes() {
  const { dados, hoje, indices, planejar } = useAcoes()
  const r = separarRevisoes(dados.atividades, hoje)
  const feitas = dados.sessoes.filter((s) => s.tipo === 'revisao').slice(0, 15)

  return (
    <>
      <button className="botao primario largo" onClick={() => planejar({ tipo: 'revisao', data: somarDias(hoje, 1) })}>
        <Icone nome="revisao" tamanho={18} /> Agendar revisão
      </button>
      {r.atrasadas.length > 0 && (
        <Secao titulo="Atrasadas">
          <ListaAtividades atividades={r.atrasadas} />
        </Secao>
      )}
      <Secao titulo="Para hoje">
        <ListaAtividades atividades={r.hoje} vazio="Nenhuma revisão para hoje." />
      </Secao>
      <Secao titulo="Próximas">
        <ListaAtividades atividades={r.proximas} vazio="Nenhuma revisão agendada." mostrarData />
      </Secao>
      <Secao titulo="Realizadas">
        {feitas.length === 0 ? (
          <p className="sutil vazio-curto">Nenhuma revisão registrada ainda.</p>
        ) : (
          <ul className="lista-simples">
            {feitas.map((s) => (
              <li key={s.id}>
                {s.data === hoje ? 'Hoje' : dataCurta(s.data)} · {indices.conteudo.get(s.conteudoId)?.nome ?? '—'}
                {s.minutos ? ` · ${formatarMinutos(s.minutos)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </>
  )
}
