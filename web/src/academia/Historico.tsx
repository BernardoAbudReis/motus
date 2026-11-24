import { useState } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Exercicio, SessaoTreino } from '../db'
import { DetalheExercicio } from './Biblioteca'
import { excluirTreino } from './dados'
import { finalizadas, formatarDuracaoLonga, formatarPeso, formatarVolume, resumir } from './logica'

function dataLonga(ms: number) {
  const t = new Date(ms).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function hora(ms: number) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function DetalheSessao({
  sessao,
  onAbrirExercicio,
  onFechar,
}: {
  sessao: SessaoTreino
  onAbrirExercicio: (id: string) => void
  onFechar: () => void
}) {
  const r = resumir(sessao)

  async function apagar() {
    if (!confirm('Excluir este treino do histórico?')) return
    await excluirTreino(sessao.id)
    onFechar()
  }

  return (
    <Folha titulo={sessao.fichaNome} onFechar={onFechar}>
      <p className="sutil">
        {dataLonga(sessao.iniciadaEm)}, {hora(sessao.iniciadaEm)}
      </p>
      <div className="grade-estatisticas tres">
        <div>
          <strong>{formatarDuracaoLonga(sessao.duracaoSeg)}</strong>
          <span>duração</span>
        </div>
        <div>
          <strong>{r.seriesFeitas}</strong>
          <span>séries</span>
        </div>
        <div>
          <strong>{formatarVolume(r.volume)}</strong>
          <span>volume</span>
        </div>
      </div>
      {sessao.observacoes && <p className="observacao">{sessao.observacoes}</p>}

      <ul className="lista-sessao-exercicios">
        {sessao.exercicios.map((e, i) => {
          const feitas = e.series.filter((s) => s.concluida)
          return (
            <li key={i}>
              <button className="item-exercicio" onClick={() => onAbrirExercicio(e.exercicioId)}>
                <span>
                  <strong>{e.nome}</strong>
                  <span className="sutil">
                    {feitas.length
                      ? feitas.map((s) => `${formatarPeso(s.peso)} × ${s.repeticoes}`).join(' · ')
                      : 'Nenhuma série concluída'}
                  </span>
                </span>
                <Icone nome="grafico" tamanho={18} />
              </button>
            </li>
          )
        })}
      </ul>
      <button className="botao-link perigo" onClick={() => void apagar()}>
        Excluir treino
      </button>
    </Folha>
  )
}

export function Historico({ sessoes, exercicios }: { sessoes: SessaoTreino[]; exercicios: Exercicio[] }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [exercicioAberto, setExercicioAberto] = useState<string | null>(null)
  const lista = finalizadas(sessoes)
  const sessaoAberta = lista.find((s) => s.id === aberta)

  // Exercício do histórico pode ter sido excluído da biblioteca: usa os dados copiados no treino.
  const exAberto: Exercicio | undefined =
    exercicioAberto === null
      ? undefined
      : (exercicios.find((e) => e.id === exercicioAberto) ??
        (() => {
          const copia = sessoes.flatMap((s) => s.exercicios).find((e) => e.exercicioId === exercicioAberto)
          return copia
            ? {
                id: copia.exercicioId,
                nome: copia.nome,
                grupoMuscular: copia.grupoMuscular,
                equipamento: copia.equipamento,
                descricao: '',
                imagem: null,
                personalizado: true,
                updatedAt: 0,
                deletedAt: null,
                dirty: 0 as const,
              }
            : undefined
        })())

  if (lista.length === 0) {
    return (
      <div className="vazio">
        <p className="vazio-titulo">Nenhum treino finalizado ainda</p>
        <p>Os treinos aparecem aqui ao finalizar, com cada série, peso e repetição.</p>
      </div>
    )
  }

  const porMes = new Map<string, SessaoTreino[]>()
  for (const s of lista) {
    const chave = new Date(s.iniciadaEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (!porMes.has(chave)) porMes.set(chave, [])
    porMes.get(chave)!.push(s)
  }

  return (
    <>
      {[...porMes].map(([mes, itens]) => (
        <section key={mes} className="secao">
          <h3>
            {mes} · {itens.length} {itens.length === 1 ? 'treino' : 'treinos'}
          </h3>
          <ul className="lista-sessoes">
            {itens.map((s) => {
              const r = resumir(s)
              return (
                <li key={s.id}>
                  <button className="cartao-sessao" onClick={() => setAberta(s.id)}>
                    <span className="cartao-sessao-data">
                      <strong>{new Date(s.iniciadaEm).getDate()}</strong>
                      <span>{new Date(s.iniciadaEm).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                    </span>
                    <span className="cartao-sessao-textos">
                      <strong>{s.fichaNome}</strong>
                      <span className="sutil">
                        {formatarDuracaoLonga(s.duracaoSeg)} · {r.exerciciosFeitos} exercícios · {formatarVolume(r.volume)}
                      </span>
                    </span>
                    <Icone nome="avancar" tamanho={18} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {sessaoAberta && !exAberto && (
        <DetalheSessao sessao={sessaoAberta} onFechar={() => setAberta(null)} onAbrirExercicio={setExercicioAberto} />
      )}
      {exAberto && <DetalheExercicio exercicio={exAberto} sessoes={sessoes} onFechar={() => setExercicioAberto(null)} />}
    </>
  )
}
