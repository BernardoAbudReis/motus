import type { CSSProperties, ReactNode } from 'react'
import { Icone, type NomeIcone } from '../components/Icone'
import { atributosTinta } from '../cores'
import type { Atividade, TipoEstudo } from '../db'
import { ROTULO_TIPO, corMateria, useAcoes } from './contexto'
import { atrasada, dataCurta } from './logica'

/** Estudo ou revisão planejado: círculo para concluir com um toque e o corpo abre as opções. */
export function ItemAtividade({ atividade: a, mostrarData }: { atividade: Atividade; mostrarData?: boolean }) {
  const { indices, hoje, abrirAtividade, concluir } = useAcoes()
  const conteudo = indices.conteudo.get(a.conteudoId)
  const materia = conteudo && indices.materia.get(conteudo.materiaId)
  const nome = conteudo?.nome ?? 'Conteúdo excluído'
  const feita = a.estado === 'feita'
  const removida = a.estado === 'removida'
  const reagendada = a.reagendamentos.length > 0
  return (
    <div
      className={`item-atividade ${feita ? 'feita' : ''} ${removida ? 'removida' : ''} ${atrasada(a, hoje) ? 'atrasada' : ''}`}
      style={{ '--cor': corMateria(materia) } as CSSProperties}
      {...atributosTinta(materia?.cor ?? 'menta')}
    >
      <button
        className="check-atividade"
        disabled={removida}
        aria-label={feita ? `Desmarcar ${nome}` : `Marcar ${nome} como feito`}
        aria-pressed={feita}
        onClick={() => concluir(a)}
      >
        {feita && <Icone nome="check" tamanho={16} espessura={3} />}
      </button>
      <button className="item-atividade-corpo" onClick={() => abrirAtividade(a)} aria-label={`Opções de ${nome}`}>
        <strong>{nome}</strong>
        <span className="item-atividade-sub">
          {materia && (
            <span>
              {materia.icone && `${materia.icone} `}
              {materia.nome}
            </span>
          )}
          {a.tipo === 'revisao' && <span className="etiqueta revisao">Revisão</span>}
          {mostrarData && <span>{dataCurta(a.data)}</span>}
          {atrasada(a, hoje) && <span className="texto-atraso">atrasada desde {dataCurta(a.data)}</span>}
          {reagendada && !removida && <span>reagendada</span>}
          {removida && <span>removida</span>}
        </span>
      </button>
    </div>
  )
}

export function ListaAtividades({ atividades, vazio, mostrarData }: { atividades: Atividade[]; vazio?: string; mostrarData?: boolean }) {
  if (atividades.length === 0) return vazio ? <p className="sutil vazio-curto">{vazio}</p> : null
  return (
    <div className="lista-atividades">
      {atividades.map((a) => (
        <ItemAtividade key={a.id} atividade={a} mostrarData={mostrarData} />
      ))}
    </div>
  )
}

export function BarraMateria({ percentual, cor }: { percentual: number; cor: string }) {
  return (
    <span
      className="barra-materia"
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ '--fracao': percentual / 100, '--cor': cor } as CSSProperties}
    />
  )
}

export function Secao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="secao-estudos">
      <div className="titulo-secao">
        <h3>{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  )
}

/** Linha de ação dentro de uma lista agrupada (mesmo visual dos ajustes do hábito). */
export function LinhaAcao({
  icone,
  rotulo,
  onClick,
  perigo,
  valor,
}: {
  icone: NomeIcone
  rotulo: string
  onClick: () => void
  perigo?: boolean
  valor?: ReactNode
}) {
  return (
    <button type="button" className={`linha-ajuste ${perigo ? 'perigo' : ''}`} onClick={onClick}>
      <span className="ajuste-icone">
        <Icone nome={icone} tamanho={18} />
      </span>
      <span className="ajuste-rotulo">{rotulo}</span>
      {valor && <span className="ajuste-valor">{valor}</span>}
    </button>
  )
}

/** Escolha de conteúdo agrupada por matéria (rápida no celular: usa o seletor do sistema). */
export function SeletorConteudo({ valor, onMudar }: { valor: string; onMudar: (id: string) => void }) {
  const { dados } = useAcoes()
  const materias = dados.materias.filter((m) => !m.arquivada)
  return (
    <label>
      Conteúdo
      <select value={valor} onChange={(e) => onMudar(e.target.value)}>
        <option value="">Escolha um conteúdo</option>
        {materias.map((m) => (
          <optgroup key={m.id} label={m.nome}>
            {dados.conteudos
              .filter((c) => c.materiaId === m.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.status === 'concluido' ? ' (concluído)' : ''}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export function AlternadorTipo({ valor, onMudar }: { valor: TipoEstudo; onMudar: (t: TipoEstudo) => void }) {
  return (
    <div className="alternador" role="radiogroup" aria-label="Tipo">
      {(['estudo', 'revisao'] as const).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={valor === t} className={valor === t ? 'ativo' : ''} onClick={() => onMudar(t)}>
          {ROTULO_TIPO[t]}
        </button>
      ))}
    </div>
  )
}

export function Numero({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div className="resumo-item">
      <span className="resumo-valor">{valor}</span>
      <span className="resumo-rotulo">{rotulo}</span>
    </div>
  )
}
