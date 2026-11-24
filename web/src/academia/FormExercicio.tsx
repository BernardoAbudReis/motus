import { useState, type FormEvent } from 'react'
import { Folha } from '../components/Folha'
import type { Exercicio } from '../db'
import { EQUIPAMENTOS, GRUPOS_MUSCULARES } from './catalogo'
import { excluirExercicio, reduzirImagem, salvarExercicio } from './dados'

export function FormExercicio({
  exercicio,
  onFechar,
  onSalvo,
}: {
  exercicio?: Exercicio
  onFechar: () => void
  onSalvo?: (id: string) => void
}) {
  const [nome, setNome] = useState(exercicio?.nome ?? '')
  const [grupo, setGrupo] = useState(exercicio?.grupoMuscular ?? 'Peito')
  const [equipamento, setEquipamento] = useState(exercicio?.equipamento ?? 'Halteres')
  const [descricao, setDescricao] = useState(exercicio?.descricao ?? '')
  const [imagem, setImagem] = useState<string | null>(exercicio?.imagem ?? null)
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome ao exercício.')
    const campos = { nome: nome.trim(), grupoMuscular: grupo, equipamento, descricao: descricao.trim(), imagem }
    const salvo = await salvarExercicio(exercicio?.id ?? null, campos)
    onSalvo?.(exercicio?.id ?? (salvo as Exercicio).id)
    onFechar()
  }

  async function escolherImagem(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      setImagem(await reduzirImagem(arquivo))
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  async function apagar() {
    if (!exercicio) return
    if (!confirm(`Excluir "${exercicio.nome}" da biblioteca? Os treinos já feitos continuam no histórico.`)) return
    await excluirExercicio(exercicio.id)
    onFechar()
  }

  return (
    <Folha titulo={exercicio ? 'Editar exercício' : 'Novo exercício'} onFechar={onFechar}>
      <form className="formulario" onSubmit={enviar}>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Supino com pegada fechada" maxLength={80} autoFocus={!exercicio} />
        </label>
        <div className="linha-campos">
          <label>
            Grupo muscular
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              {GRUPOS_MUSCULARES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Equipamento
            <select value={equipamento} onChange={(e) => setEquipamento(e.target.value)}>
              {EQUIPAMENTOS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Descrição (opcional)
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Como executar, ajustes da máquina…" maxLength={600} />
        </label>
        <fieldset>
          <legend>Imagem (opcional)</legend>
          {imagem && <img src={imagem} alt="" className="imagem-exercicio" />}
          <div className="linha-botoes">
            <label className="botao">
              {imagem ? 'Trocar imagem' : 'Escolher imagem'}
              <input type="file" accept="image/*" hidden onChange={(e) => void escolherImagem(e.target.files?.[0])} />
            </label>
            {imagem && (
              <button type="button" className="botao" onClick={() => setImagem(null)}>
                Remover
              </button>
            )}
          </div>
        </fieldset>
        {erro && <p className="erro">{erro}</p>}
        <button className="botao primario largo">{exercicio ? 'Salvar' : 'Cadastrar exercício'}</button>
        {exercicio && (
          <button type="button" className="botao-link perigo" onClick={() => void apagar()}>
            Excluir exercício
          </button>
        )}
      </form>
    </Folha>
  )
}
