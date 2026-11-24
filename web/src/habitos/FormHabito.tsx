import { useState, type CSSProperties, type FormEvent } from 'react'
import { Folha } from '../components/Folha'
import type { Habito, Meta } from '../db'
import { CORES_HABITO, ICONES_HABITO, atualizarHabito, criarHabito, excluirHabito, type CamposHabito } from './dados'
import { DIAS_CURTOS } from './logica'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function FormHabito({ habito, onFechar }: { habito?: Habito; onFechar: () => void }) {
  const [nome, setNome] = useState(habito?.nome ?? '')
  const [icone, setIcone] = useState(habito?.icone ?? '✅')
  const [cor, setCor] = useState(habito?.cor ?? 'menta')
  const [tipoFreq, setTipoFreq] = useState(habito?.frequencia.tipo ?? 'diaria')
  const [dias, setDias] = useState<number[]>(habito?.frequencia.tipo === 'dias' ? habito.frequencia.dias : [1, 3, 5])
  const [tipoMeta, setTipoMeta] = useState<Meta['tipo']>(habito?.meta.tipo ?? 'check')
  const [quantidade, setQuantidade] = useState(habito?.meta.tipo === 'quantidade' ? habito.meta.alvo : 8)
  const [unidade, setUnidade] = useState(habito?.meta.tipo === 'quantidade' ? habito.meta.unidade : 'vezes')
  const [minutos, setMinutos] = useState(habito?.meta.tipo === 'tempo' ? habito.meta.alvoMin : 30)
  const [erro, setErro] = useState('')

  function alternarDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d]))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome ao hábito.')
    if (tipoFreq === 'dias' && dias.length === 0) return setErro('Escolha pelo menos um dia.')
    if (tipoMeta === 'quantidade' && !(quantidade > 0)) return setErro('A meta precisa ser maior que zero.')
    if (tipoMeta === 'tempo' && !(minutos > 0)) return setErro('O tempo precisa ser maior que zero.')

    const campos: CamposHabito = {
      nome: nome.trim(),
      icone: icone.trim() || '✅',
      cor,
      frequencia: tipoFreq === 'diaria' ? { tipo: 'diaria' } : { tipo: 'dias', dias: [...dias].sort() },
      meta:
        tipoMeta === 'check'
          ? { tipo: 'check' }
          : tipoMeta === 'quantidade'
            ? { tipo: 'quantidade', alvo: quantidade, unidade: unidade.trim() }
            : { tipo: 'tempo', alvoMin: minutos },
    }
    if (habito) await atualizarHabito(habito.id, campos)
    else await criarHabito(campos)
    onFechar()
  }

  async function apagar() {
    if (!habito) return
    if (!confirm(`Excluir "${habito.nome}" e todo o histórico? Para só esconder, use Arquivar.`)) return
    await excluirHabito(habito.id)
    onFechar()
  }

  return (
    <Folha titulo={habito ? 'Editar hábito' : 'Novo hábito'} onFechar={onFechar}>
      <form className="formulario" onSubmit={enviar}>
        <div
          className="previa-habito"
          style={{ '--cor': CORES_HABITO.find((c) => c.id === cor)?.hex } as CSSProperties}
          aria-hidden
        >
          <span className="habito-icone">{icone || '✅'}</span>
          <strong>{nome || 'Nome do hábito'}</strong>
        </div>

        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ler um livro" maxLength={60} autoFocus={!habito} />
        </label>

        <fieldset>
          <legend>Ícone</legend>
          <div className="grade-icones">
            {ICONES_HABITO.map((i) => (
              <button type="button" key={i} className={i === icone ? 'ativo' : ''} aria-pressed={i === icone} onClick={() => setIcone(i)}>
                {i}
              </button>
            ))}
          </div>
          <label className="rotulo-inline">
            Ou digite um emoji
            <input value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={8} className="campo-emoji" />
          </label>
        </fieldset>

        <fieldset>
          <legend>Cor</legend>
          <div className="grade-cores">
            {CORES_HABITO.map((c) => (
              <button
                type="button"
                key={c.id}
                className={c.id === cor ? 'ativo' : ''}
                style={{ '--cor': c.hex } as CSSProperties}
                aria-label={c.nome}
                aria-pressed={c.id === cor}
                onClick={() => setCor(c.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Frequência</legend>
          <div className="alternador">
            <button type="button" className={tipoFreq === 'diaria' ? 'ativo' : ''} aria-pressed={tipoFreq === 'diaria'} onClick={() => setTipoFreq('diaria')}>
              Todo dia
            </button>
            <button type="button" className={tipoFreq === 'dias' ? 'ativo' : ''} aria-pressed={tipoFreq === 'dias'} onClick={() => setTipoFreq('dias')}>
              Dias específicos
            </button>
          </div>
          {tipoFreq === 'dias' && (
            <div className="grade-dias">
              {ORDEM_DIAS.map((d) => (
                <button type="button" key={d} className={dias.includes(d) ? 'ativo' : ''} aria-pressed={dias.includes(d)} onClick={() => alternarDia(d)}>
                  {DIAS_CURTOS[d].replace('.', '')}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Meta</legend>
          <div className="alternador tres">
            {(
              [
                ['check', 'Marcar'],
                ['quantidade', 'Quantidade'],
                ['tempo', 'Tempo'],
              ] as const
            ).map(([t, r]) => (
              <button type="button" key={t} className={tipoMeta === t ? 'ativo' : ''} aria-pressed={tipoMeta === t} onClick={() => setTipoMeta(t)}>
                {r}
              </button>
            ))}
          </div>
          {tipoMeta === 'quantidade' && (
            <div className="linha-campos">
              <label>
                Meta por dia
                <input type="number" inputMode="decimal" min={0.1} step="any" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              </label>
              <label>
                Unidade
                <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="copos, páginas…" maxLength={20} />
              </label>
            </div>
          )}
          {tipoMeta === 'tempo' && (
            <label>
              Minutos por dia
              <input type="number" inputMode="numeric" min={1} step={1} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
            </label>
          )}
        </fieldset>

        {erro && <p className="erro">{erro}</p>}
        <button className="botao primario largo">{habito ? 'Salvar' : 'Criar hábito'}</button>
        {habito && (
          <button type="button" className="botao-link perigo" onClick={() => void apagar()}>
            Excluir hábito
          </button>
        )}
      </form>
    </Folha>
  )
}
