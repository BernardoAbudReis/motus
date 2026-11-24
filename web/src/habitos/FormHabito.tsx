import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Folha } from '../components/Folha'
import { Icone, type NomeIcone } from '../components/Icone'
import type { Frequencia, Habito, Meta } from '../db'
import { dataLocal } from '../repo'
import { CORES_HABITO, ICONES_HABITO, arquivarHabito, atualizarHabito, corDoHabito, criarHabito, tintaDoHabito, excluirHabito, useConclusoes, type CamposHabito } from './dados'
import { MINIMO_CONCLUSOES, horarioDoLembrete, lembreteDe, minutosParaHorario } from './lembrete'
import { DIAS_CURTOS, descreverFrequencia, descreverMeta, lerData } from './logica'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]
const LIMITE_NOME = 60

type Painel = 'cor' | 'icone' | 'meta' | 'repeticao' | 'lembrete' | null

/** Linha de ajuste: ícone à esquerda, rótulo, valor à direita e, se aberta, o painel embaixo. */
function Linha({
  icone,
  rotulo,
  valor,
  aberta,
  onAlternar,
  children,
}: {
  icone: NomeIcone
  rotulo: string
  valor: ReactNode
  aberta?: boolean
  onAlternar?: () => void
  children?: ReactNode
}) {
  return (
    <div className={`ajuste ${aberta ? 'aberta' : ''}`}>
      <button type="button" className="linha-ajuste" onClick={onAlternar} aria-expanded={children ? !!aberta : undefined}>
        <span className="ajuste-icone">
          <Icone nome={icone} tamanho={18} />
        </span>
        <span className="ajuste-rotulo">{rotulo}</span>
        <span className="ajuste-valor">
          {valor}
          {children && <Icone nome={aberta ? 'subir' : 'avancar'} tamanho={18} />}
        </span>
      </button>
      {aberta && children && <div className="painel-ajuste">{children}</div>}
    </div>
  )
}

export function FormHabito({ habito, onFechar }: { habito?: Habito; onFechar: () => void }) {
  const hoje = dataLocal()
  const [nome, setNome] = useState(habito?.nome ?? '')
  const [icone, setIcone] = useState(habito?.icone ?? '✅')
  const [cor, setCor] = useState(habito?.cor ?? 'menta')
  const [tipoFreq, setTipoFreq] = useState<Frequencia['tipo']>(habito?.frequencia.tipo ?? 'diaria')
  const [dias, setDias] = useState<number[]>(habito?.frequencia.tipo === 'dias' ? habito.frequencia.dias : [1, 3, 5])
  const [tipoMeta, setTipoMeta] = useState<Meta['tipo']>(habito?.meta.tipo ?? 'check')
  const [quantidade, setQuantidade] = useState(habito?.meta.tipo === 'quantidade' ? habito.meta.alvo : 8)
  const [unidade, setUnidade] = useState(habito?.meta.tipo === 'quantidade' ? habito.meta.unidade : 'vezes')
  const [minutos, setMinutos] = useState(habito?.meta.tipo === 'tempo' ? habito.meta.alvoMin : 30)
  const [inicio, setInicio] = useState(() => (habito ? dataLocal(new Date(habito.criadoEm)) : hoje))
  const lembreteInicial = lembreteDe(habito ?? {})
  const [lembreteAtivo, setLembreteAtivo] = useState(lembreteInicial.ativo)
  const [modoLembrete, setModoLembrete] = useState(lembreteInicial.modo)
  const [horarioLembrete, setHorarioLembrete] = useState(lembreteInicial.horario)
  const conclusoes = useConclusoes(habito?.id)
  const previsto = horarioDoLembrete({ lembrete: { ativo: lembreteAtivo, modo: modoLembrete, horario: horarioLembrete } }, conclusoes)
  const [painel, setPainel] = useState<Painel>(habito ? null : 'icone')
  const [erro, setErro] = useState('')

  const frequencia: Frequencia = tipoFreq === 'diaria' ? { tipo: 'diaria' } : { tipo: 'dias', dias: [...dias].sort() }
  const meta: Meta =
    tipoMeta === 'check'
      ? { tipo: 'check' }
      : tipoMeta === 'quantidade'
        ? { tipo: 'quantidade', alvo: quantidade, unidade: unidade.trim() }
        : { tipo: 'tempo', alvoMin: minutos }
  const alternar = (p: Painel) => setPainel(painel === p ? null : p)

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
      frequencia,
      meta,
      lembrete: { ativo: lembreteAtivo, modo: modoLembrete, horario: horarioLembrete },
    }
    // "Começa em" define a partir de quando o hábito conta nas estatísticas.
    const criadoEm = lerData(inicio > hoje ? hoje : inicio).getTime()
    if (habito) await atualizarHabito(habito.id, { ...campos, criadoEm })
    else await criarHabito(campos, criadoEm)
    onFechar()
  }

  async function apagar() {
    if (!habito) return
    if (!confirm(`Excluir "${habito.nome}" e todo o histórico? Para só esconder, use Arquivar.`)) return
    await excluirHabito(habito.id)
    onFechar()
  }

  const corHex = corDoHabito(cor)

  return (
    <Folha
      titulo={habito ? 'Editar hábito' : 'Novo hábito'}
      onFechar={onFechar}
      acao={
        <button type="submit" form="form-habito" className="botao-salvar" style={{ '--cor': corHex } as CSSProperties} aria-label="Salvar hábito">
          <Icone nome="check" tamanho={22} espessura={2.6} />
        </button>
      }
    >
      <form id="form-habito" className="formulario" onSubmit={enviar}>
        <div className="previa-habito" data-tinta={tintaDoHabito(cor)} style={{ '--cor': corHex } as CSSProperties}>
          <span className="habito-icone" aria-hidden>
            {icone || '✅'}
          </span>
          <span className="previa-textos">
            <input
              className="previa-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, LIMITE_NOME))}
              placeholder="Nome do hábito"
              aria-label="Nome"
              autoFocus={!habito}
            />
            <span className="habito-sub">{descreverFrequencia(frequencia)}</span>
          </span>
          <Icone nome="editar" tamanho={18} />
        </div>
        <p className="contador-caracteres">
          {nome.length}/{LIMITE_NOME}
        </p>

        <h3 className="grupo-titulo">Aparência</h3>
        <div className="lista-agrupada">
          <Linha icone="paleta" rotulo="Cor" valor={<span className="amostra-cor" style={{ background: corHex }} />} aberta={painel === 'cor'} onAlternar={() => alternar('cor')}>
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
          </Linha>
          <Linha icone="sorriso" rotulo="Ícone" valor={<span className="valor-emoji">{icone}</span>} aberta={painel === 'icone'} onAlternar={() => alternar('icone')}>
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
          </Linha>
        </div>

        <h3 className="grupo-titulo">Geral</h3>
        <div className="lista-agrupada">
          <Linha icone="alvo" rotulo="Meta" valor={descreverMeta(meta)} aberta={painel === 'meta'} onAlternar={() => alternar('meta')}>
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
              <label className="campo-solto">
                Minutos por dia
                <input type="number" inputMode="numeric" min={1} step={1} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
              </label>
            )}
          </Linha>
          <Linha icone="repetir" rotulo="Repetição" valor={descreverFrequencia(frequencia)} aberta={painel === 'repeticao'} onAlternar={() => alternar('repeticao')}>
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
            )}
          </Linha>
          <div className="ajuste">
            <label className="linha-ajuste">
              <span className="ajuste-icone">
                <Icone nome="calendario" tamanho={18} />
              </span>
              <span className="ajuste-rotulo">Começa em</span>
              <input type="date" className="campo-data" value={inicio} max={hoje} onChange={(e) => e.target.value && setInicio(e.target.value)} />
            </label>
          </div>
          <Linha
            icone="sino"
            rotulo="Lembrete"
            valor={!lembreteAtivo ? 'Desligado' : modoLembrete === 'auto' ? `Automático · ${minutosParaHorario(previsto.minutos)}` : horarioLembrete}
            aberta={painel === 'lembrete'}
            onAlternar={() => alternar('lembrete')}
          >
            <label className="linha-interruptor">
              <span>Avisar quando ainda não tiver feito</span>
              <input type="checkbox" role="switch" className="interruptor" checked={lembreteAtivo} onChange={(e) => setLembreteAtivo(e.target.checked)} />
            </label>
            {lembreteAtivo && (
              <>
                <div className="alternador">
                  <button type="button" className={modoLembrete === 'auto' ? 'ativo' : ''} aria-pressed={modoLembrete === 'auto'} onClick={() => setModoLembrete('auto')}>
                    Automático
                  </button>
                  <button type="button" className={modoLembrete === 'fixo' ? 'ativo' : ''} aria-pressed={modoLembrete === 'fixo'} onClick={() => setModoLembrete('fixo')}>
                    Horário fixo
                  </button>
                </div>
                {modoLembrete === 'auto' && (
                  <p className="sutil">
                    {previsto.origem === 'media'
                      ? `Você costuma concluir por volta das ${minutosParaHorario(previsto.minutos)} (média das últimas ${previsto.amostras} vezes). O horário se ajusta sozinho.`
                      : `Ainda não há conclusões suficientes para calcular a média (${previsto.amostras} de ${MINIMO_CONCLUSOES}). Até lá, o aviso vem no horário abaixo.`}
                  </p>
                )}
                {(modoLembrete === 'fixo' || previsto.origem !== 'media') && (
                  <label className="rotulo-inline">
                    {modoLembrete === 'fixo' ? 'Avisar às' : 'Horário até ter a média'}
                    <input type="time" className="campo-data" value={horarioLembrete} onChange={(e) => e.target.value && setHorarioLembrete(e.target.value)} />
                  </label>
                )}
              </>
            )}
          </Linha>
        </div>

        {erro && <p className="erro">{erro}</p>}

        {habito && (
          <div className="lista-agrupada acoes-perigosas">
            <button
              type="button"
              className="linha-ajuste"
              onClick={() => {
                void arquivarHabito(habito.id, !habito.arquivado)
                onFechar()
              }}
            >
              <span className="ajuste-icone">
                <Icone nome={habito.arquivado ? 'desarquivar' : 'arquivo'} tamanho={18} />
              </span>
              <span className="ajuste-rotulo">{habito.arquivado ? 'Desarquivar' : 'Arquivar'}</span>
            </button>
            <button type="button" className="linha-ajuste perigo" onClick={() => void apagar()}>
              <span className="ajuste-icone">
                <Icone nome="lixeira" tamanho={18} />
              </span>
              <span className="ajuste-rotulo">Excluir hábito</span>
            </button>
          </div>
        )}
      </form>
    </Folha>
  )
}
