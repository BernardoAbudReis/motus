import { useState } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Exercicio, SessaoTreino } from '../db'
import { useFiltroExercicios, FiltroExercicios } from './SeletorExercicio'
import { FormExercicio } from './FormExercicio'
import { GraficoEvolucao } from './GraficoEvolucao'
import { evolucao, formatarPeso, formatarVolume } from './logica'

/** Detalhe do exercício: dados, evolução das cargas (gráfico + tabela). */
export function DetalheExercicio({
  exercicio,
  sessoes,
  onEditar,
  onFechar,
}: {
  exercicio: Exercicio
  sessoes: SessaoTreino[]
  onEditar?: () => void
  onFechar: () => void
}) {
  const pontos = evolucao(exercicio.id, sessoes)
  const recorde = pontos.reduce<(typeof pontos)[number] | null>((m, p) => (!m || p.cargaMax > m.cargaMax ? p : m), null)

  return (
    <Folha titulo={exercicio.nome} onFechar={onFechar}>
      <p className="sutil">
        {exercicio.grupoMuscular} · {exercicio.equipamento}
        {exercicio.personalizado && ' · personalizado'}
      </p>
      {exercicio.imagem && <img src={exercicio.imagem} alt={`Imagem do exercício ${exercicio.nome}`} className="imagem-exercicio" />}
      {exercicio.descricao && <p className="descricao">{exercicio.descricao}</p>}

      <section className="secao">
        <h3>Evolução</h3>
        {pontos.length === 0 ? (
          <p className="sutil">Ainda não há treinos finalizados com este exercício.</p>
        ) : (
          <>
            <div className="grade-estatisticas tres">
              <div>
                <strong>{formatarPeso(recorde!.cargaMax)}</strong>
                <span>recorde</span>
              </div>
              <div>
                <strong>{formatarPeso(pontos[pontos.length - 1].cargaMax)}</strong>
                <span>último treino</span>
              </div>
              <div>
                <strong>{pontos.length}</strong>
                <span>{pontos.length === 1 ? 'treino' : 'treinos'}</span>
              </div>
            </div>
            <GraficoEvolucao pontos={pontos} />
            <table className="tabela">
              <caption className="sr-only">Histórico do exercício por treino</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Séries</th>
                  <th scope="col" className="num">
                    Volume
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...pontos].reverse().map((p) => (
                  <tr key={p.sessaoId}>
                    <td>{new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td>{p.series.map((s) => `${s.peso.toLocaleString('pt-BR')}×${s.repeticoes}`).join('  ')}</td>
                    <td className="num">{formatarVolume(p.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {onEditar && (
        <button className="botao largo" onClick={onEditar}>
          <Icone nome="editar" tamanho={18} /> Editar exercício
        </button>
      )}
    </Folha>
  )
}

export function Biblioteca({ exercicios, sessoes }: { exercicios: Exercicio[]; sessoes: SessaoTreino[] }) {
  const filtro = useFiltroExercicios(exercicios)
  const [aberto, setAberto] = useState<string | null>(null)
  const [form, setForm] = useState<{ exercicio?: Exercicio } | null>(null)
  const exAberto = exercicios.find((e) => e.id === aberto)

  return (
    <>
      <FiltroExercicios {...filtro} />
      <button className="botao largo" onClick={() => setForm({})}>
        <Icone nome="mais" tamanho={18} /> Novo exercício
      </button>
      <ul className="lista-exercicios">
        {filtro.filtrados.map((e) => (
          <li key={e.id}>
            <button className="item-exercicio" onClick={() => setAberto(e.id)}>
              {e.imagem ? <img src={e.imagem} alt="" className="miniatura" /> : <span className="miniatura vazia" aria-hidden />}
              <span>
                <strong>{e.nome}</strong>
                <span className="sutil">
                  {e.grupoMuscular} · {e.equipamento}
                </span>
              </span>
              <Icone nome="avancar" tamanho={18} />
            </button>
          </li>
        ))}
      </ul>
      {filtro.filtrados.length === 0 && <p className="sutil centro">Nenhum exercício encontrado.</p>}

      {exAberto && (
        <DetalheExercicio
          exercicio={exAberto}
          sessoes={sessoes}
          onFechar={() => setAberto(null)}
          onEditar={() => {
            setAberto(null)
            setForm({ exercicio: exAberto })
          }}
        />
      )}
      {form && <FormExercicio exercicio={form.exercicio} onFechar={() => setForm(null)} />}
    </>
  )
}
