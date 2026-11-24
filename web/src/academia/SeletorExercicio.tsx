import { useMemo, useState } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Exercicio } from '../db'
import { GRUPOS_MUSCULARES } from './catalogo'

/** Busca por nome e filtro por grupo muscular. Usado na biblioteca e ao montar a ficha. */
export function useFiltroExercicios(exercicios: Exercicio[]) {
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const filtrados = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    return exercicios.filter((e) => {
      if (grupo && e.grupoMuscular !== grupo) return false
      if (!termo) return true
      return e.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .includes(termo)
    })
  }, [exercicios, busca, grupo])
  return { busca, setBusca, grupo, setGrupo, filtrados }
}

export function FiltroExercicios({
  busca,
  setBusca,
  grupo,
  setGrupo,
}: {
  busca: string
  setBusca: (s: string) => void
  grupo: string
  setGrupo: (s: string) => void
}) {
  return (
    <div className="filtro-exercicios">
      <label className="campo-busca">
        <Icone nome="busca" tamanho={18} />
        <input type="search" placeholder="Buscar exercício" aria-label="Buscar exercício" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Grupo muscular">
        <button className={grupo === '' ? 'chip ativo' : 'chip'} aria-pressed={grupo === ''} onClick={() => setGrupo('')}>
          Todos
        </button>
        {GRUPOS_MUSCULARES.map((g) => (
          <button key={g} className={grupo === g ? 'chip ativo' : 'chip'} aria-pressed={grupo === g} onClick={() => setGrupo(grupo === g ? '' : g)}>
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SeletorExercicio({
  exercicios,
  onEscolher,
  onFechar,
  onNovo,
}: {
  exercicios: Exercicio[]
  onEscolher: (e: Exercicio) => void
  onFechar: () => void
  onNovo: () => void
}) {
  const filtro = useFiltroExercicios(exercicios)
  return (
    <Folha titulo="Adicionar exercício" onFechar={onFechar}>
      <FiltroExercicios {...filtro} />
      <ul className="lista-exercicios">
        {filtro.filtrados.map((e) => (
          <li key={e.id}>
            <button className="item-exercicio" onClick={() => onEscolher(e)}>
              <span>
                <strong>{e.nome}</strong>
                <span className="sutil">
                  {e.grupoMuscular} · {e.equipamento}
                </span>
              </span>
              <Icone nome="mais" tamanho={20} />
            </button>
          </li>
        ))}
      </ul>
      {filtro.filtrados.length === 0 && <p className="sutil centro">Nenhum exercício encontrado.</p>}
      <button className="botao largo" onClick={onNovo}>
        Cadastrar exercício personalizado
      </button>
    </Folha>
  )
}
