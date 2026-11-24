import { useState, type FormEvent } from 'react'
import { CampoNumero } from '../components/CampoNumero'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Exercicio, Ficha, ItemFicha } from '../db'
import { DIAS_CURTOS } from '../habitos/logica'
import { novoId } from '../repo'
import { duplicarFicha, excluirFicha, salvarFicha } from './dados'
import { FormExercicio } from './FormExercicio'
import { SeletorExercicio } from './SeletorExercicio'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

function ItemDaFicha({
  item,
  exercicio,
  posicao,
  total,
  onMudar,
  onMover,
  onRemover,
}: {
  item: ItemFicha
  exercicio?: Exercicio
  posicao: number
  total: number
  onMudar: (campos: Partial<ItemFicha>) => void
  onMover: (delta: number) => void
  onRemover: () => void
}) {
  return (
    <li className="item-ficha">
      <div className="item-ficha-topo">
        <span className="item-ficha-numero">{posicao + 1}</span>
        <span className="item-ficha-nome">
          <strong>{exercicio?.nome ?? 'Exercício removido'}</strong>
          <span className="sutil">{exercicio?.grupoMuscular}</span>
        </span>
        <button type="button" className="botao-icone" aria-label="Mover para cima" disabled={posicao === 0} onClick={() => onMover(-1)}>
          <Icone nome="subir" tamanho={20} />
        </button>
        <button type="button" className="botao-icone" aria-label="Mover para baixo" disabled={posicao === total - 1} onClick={() => onMover(1)}>
          <Icone nome="descer" tamanho={20} />
        </button>
        <button type="button" className="botao-icone" aria-label={`Remover ${exercicio?.nome ?? 'exercício'}`} onClick={onRemover}>
          <Icone nome="lixeira" tamanho={18} />
        </button>
      </div>
      <div className="item-ficha-config">
        <label>
          Séries
          <CampoNumero valor={item.series} inteiro rotulo="Séries" onMudar={(n) => onMudar({ series: Math.max(1, Math.min(20, n)) })} />
        </label>
        <label>
          Repetições
          <CampoNumero valor={item.repeticoes} inteiro rotulo="Repetições" onMudar={(n) => onMudar({ repeticoes: n })} />
        </label>
        <label>
          Peso inicial
          <CampoNumero valor={item.peso} rotulo="Peso inicial" sufixo="kg" onMudar={(n) => onMudar({ peso: n })} />
        </label>
        <label>
          Descanso
          <CampoNumero valor={item.descansoSeg} inteiro rotulo="Descanso em segundos" sufixo="s" onMudar={(n) => onMudar({ descansoSeg: n })} />
        </label>
      </div>
      <input
        className="item-ficha-obs"
        placeholder="Observações (opcional)"
        aria-label="Observações"
        value={item.observacoes}
        maxLength={200}
        onChange={(e) => onMudar({ observacoes: e.target.value })}
      />
    </li>
  )
}

export function FormFicha({
  ficha,
  exercicios,
  onFechar,
}: {
  ficha?: Ficha
  exercicios: Exercicio[]
  onFechar: () => void
}) {
  const porId = new Map(exercicios.map((e) => [e.id, e]))
  const [nome, setNome] = useState(ficha?.nome ?? '')
  const [descricao, setDescricao] = useState(ficha?.descricao ?? '')
  const [dias, setDias] = useState<number[]>(ficha?.diasSemana ?? [])
  const [itens, setItens] = useState<ItemFicha[]>(ficha?.itens ?? [])
  const [escolhendo, setEscolhendo] = useState(false)
  const [criandoExercicio, setCriandoExercicio] = useState(false)
  const [erro, setErro] = useState('')

  function adicionar(e: Exercicio) {
    setItens((atual) => [
      ...atual,
      { id: novoId(), exercicioId: e.id, series: 3, repeticoes: 12, peso: 0, descansoSeg: 90, observacoes: '' },
    ])
    setEscolhendo(false)
  }

  function mover(i: number, delta: number) {
    setItens((atual) => {
      const copia = [...atual]
      const [item] = copia.splice(i, 1)
      copia.splice(i + delta, 0, item)
      return copia
    })
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome à ficha.')
    if (itens.length === 0) return setErro('Adicione pelo menos um exercício.')
    await salvarFicha(ficha?.id ?? null, { nome: nome.trim(), descricao: descricao.trim(), diasSemana: [...dias].sort(), itens })
    onFechar()
  }

  async function apagar() {
    if (!ficha) return
    if (!confirm(`Excluir a ficha "${ficha.nome}"? Os treinos já feitos com ela continuam no histórico.`)) return
    await excluirFicha(ficha.id)
    onFechar()
  }

  return (
    <>
      <Folha
        titulo={ficha ? 'Editar ficha' : 'Nova ficha'}
        onFechar={onFechar}
        rodape={
          <button className="botao primario largo" form="form-ficha">
            {ficha ? 'Salvar ficha' : 'Criar ficha'}
          </button>
        }
      >
        <form id="form-ficha" className="formulario" onSubmit={enviar}>
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Treino A — Peito e tríceps" maxLength={60} autoFocus={!ficha} />
          </label>
          <label>
            Descrição (opcional)
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Foco, objetivo…" maxLength={140} />
          </label>
          <fieldset>
            <legend>Dias da semana</legend>
            <div className="grade-dias">
              {ORDEM_DIAS.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={dias.includes(d) ? 'ativo' : ''}
                  aria-pressed={dias.includes(d)}
                  onClick={() => setDias((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))}
                >
                  {DIAS_CURTOS[d].replace('.', '')}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Exercícios</legend>
            {itens.length > 0 && (
              <ol className="lista-itens-ficha">
                {itens.map((item, i) => (
                  <ItemDaFicha
                    key={item.id}
                    item={item}
                    exercicio={porId.get(item.exercicioId)}
                    posicao={i}
                    total={itens.length}
                    onMudar={(c) => setItens((a) => a.map((x) => (x.id === item.id ? { ...x, ...c } : x)))}
                    onMover={(d) => mover(i, d)}
                    onRemover={() => setItens((a) => a.filter((x) => x.id !== item.id))}
                  />
                ))}
              </ol>
            )}
            <button type="button" className="botao largo" onClick={() => setEscolhendo(true)}>
              <Icone nome="mais" tamanho={18} /> Adicionar exercício
            </button>
          </fieldset>

          {erro && <p className="erro">{erro}</p>}
          {ficha && (
            <div className="linha-botoes centro-flex">
              <button
                type="button"
                className="botao"
                onClick={() => {
                  void duplicarFicha(ficha)
                  onFechar()
                }}
              >
                <Icone nome="copiar" tamanho={18} /> Duplicar
              </button>
              <button type="button" className="botao perigo" onClick={() => void apagar()}>
                <Icone nome="lixeira" tamanho={18} /> Excluir
              </button>
            </div>
          )}
        </form>
      </Folha>
      {escolhendo && (
        <SeletorExercicio
          exercicios={exercicios}
          onEscolher={adicionar}
          onFechar={() => setEscolhendo(false)}
          onNovo={() => {
            setEscolhendo(false)
            setCriandoExercicio(true)
          }}
        />
      )}
      {criandoExercicio && (
        <FormExercicio
          onFechar={() => setCriandoExercicio(false)}
          onSalvo={(id) =>
            setItens((a) => [...a, { id: novoId(), exercicioId: id, series: 3, repeticoes: 12, peso: 0, descansoSeg: 90, observacoes: '' }])
          }
        />
      )}
    </>
  )
}
