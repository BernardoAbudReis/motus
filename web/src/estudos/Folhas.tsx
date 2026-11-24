import { useState, type FormEvent } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Atividade, Dificuldade, SessaoEstudo, TipoEstudo } from '../db'
import { AlternadorTipo, LinhaAcao, SeletorConteudo } from './comum'
import { ROTULO_TIPO, useAcoes } from './contexto'
import {
  concluirAtividade,
  desfazerConclusao,
  detalharSessao,
  moverNaOrdem,
  planejar,
  reagendarAtividade,
  registrarSessao,
  removerAtividade,
  restaurarAtividade,
} from './dados'
import { dataCurta, doDia, inicioDaSemana, nomeDoDia, somarDias } from './logica'

/** Atalhos de data: hoje, amanhã e o mesmo dia da semana que vem. */
function AtalhosData({ base, hoje, onEscolher }: { base: string; hoje: string; onEscolher: (d: string) => void }) {
  const opcoes = [
    ['Hoje', hoje],
    ['Amanhã', somarDias(hoje, 1)],
    ['Próxima semana', somarDias(base < hoje ? hoje : base, 7)],
  ] as const
  return (
    <div className="chips quebra">
      {opcoes.map(([rotulo, d]) => (
        <button key={rotulo} type="button" className="chip" onClick={() => onEscolher(d)}>
          {rotulo}
        </button>
      ))}
    </div>
  )
}

/** Opções de uma atividade: concluir, reagendar, mover, remover. */
export function FolhaAtividade({ atividade: a, onFechar, onDetalhar }: { atividade: Atividade; onFechar: () => void; onDetalhar: () => void }) {
  const { dados, indices, hoje, abrirConteudo, concluir } = useAcoes()
  const [reagendando, setReagendando] = useState(false)
  const [novaData, setNovaData] = useState(a.data < hoje ? hoje : a.data)
  const conteudo = indices.conteudo.get(a.conteudoId)
  const materia = conteudo && indices.materia.get(conteudo.materiaId)
  const mesmoDia = doDia(dados.atividades, a.data)
  const posicao = mesmoDia.findIndex((x) => x.id === a.id)

  async function reagendar(d: string) {
    await reagendarAtividade(a, d)
    onFechar()
  }

  async function remover() {
    if (!confirm('Remover do planejamento? Ela continua no histórico da semana como removida.')) return
    await removerAtividade(a)
    onFechar()
  }

  return (
    <Folha titulo={conteudo?.nome ?? 'Atividade'} onFechar={onFechar}>
      <p className="sutil centro">
        {ROTULO_TIPO[a.tipo]}
        {materia && ` · ${materia.nome}`} · {nomeDoDia(a.data, hoje)}
      </p>
      {a.dataOriginal !== a.data && <p className="sutil centro">Planejada originalmente para {dataCurta(a.dataOriginal)}.</p>}

      {a.estado === 'planejada' && (
        <div className="linha-botoes coluna">
          <button
            className="botao primario largo"
            onClick={() => {
              concluir(a)
              onFechar()
            }}
          >
            <Icone nome="check" tamanho={18} /> Concluir
          </button>
          <button className="botao largo" onClick={onDetalhar}>
            Concluir com detalhes
          </button>
        </div>
      )}
      {a.estado === 'feita' && (
        <button
          className="botao largo"
          onClick={async () => {
            await desfazerConclusao(a)
            onFechar()
          }}
        >
          Desfazer conclusão
        </button>
      )}
      {a.estado === 'removida' && (
        <>
          <p className="centro">Removida do planejamento.</p>
          <button
            className="botao largo"
            onClick={async () => {
              await restaurarAtividade(a)
              onFechar()
            }}
          >
            Voltar ao planejamento
          </button>
        </>
      )}

      {a.estado !== 'removida' && (
        <>
          <h3 className="grupo-titulo">Organizar</h3>
          <div className="lista-agrupada">
            {a.estado === 'planejada' && (
              <LinhaAcao icone="calendario" rotulo="Reagendar" valor={dataCurta(a.data)} onClick={() => setReagendando(!reagendando)} />
            )}
            {reagendando && (
              <div className="painel-ajuste">
                <AtalhosData base={a.data} hoje={hoje} onEscolher={(d) => void reagendar(d)} />
                <div className="linha-campos">
                  <input type="date" className="campo-data" aria-label="Nova data" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                  <button className="botao primario" disabled={!novaData} onClick={() => void reagendar(novaData)}>
                    Reagendar
                  </button>
                </div>
              </div>
            )}
            {a.estado === 'planejada' && (
              <LinhaAcao
                icone="mover"
                rotulo="Transferir para a próxima semana"
                onClick={() => void reagendar(somarDias(inicioDaSemana(a.data < hoje ? hoje : a.data), 7))}
              />
            )}
            {posicao > 0 && <LinhaAcao icone="subir" rotulo="Mover para cima" onClick={() => void moverNaOrdem(a, mesmoDia, -1)} />}
            {posicao >= 0 && posicao < mesmoDia.length - 1 && (
              <LinhaAcao icone="descer" rotulo="Mover para baixo" onClick={() => void moverNaOrdem(a, mesmoDia, 1)} />
            )}
            {conteudo && <LinhaAcao icone="estudos" rotulo="Ver conteúdo" onClick={() => abrirConteudo(conteudo.id)} />}
            <LinhaAcao icone="lixeira" rotulo="Remover do planejamento" perigo onClick={() => void remover()} />
          </div>
        </>
      )}

      {a.reagendamentos.length > 0 && (
        <>
          <h3 className="grupo-titulo">Reagendamentos</h3>
          <ul className="lista-simples">
            {a.reagendamentos.map((r) => (
              <li key={r.em}>
                {dataCurta(r.de)} → {dataCurta(r.para)}
              </li>
            ))}
          </ul>
        </>
      )}
    </Folha>
  )
}

const DIFICULDADES: [Dificuldade, string][] = [
  ['facil', 'Fácil'],
  ['media', 'Média'],
  ['dificil', 'Difícil'],
]

/**
 * Registro de estudo. Três usos: completar a sessão criada pelo toque rápido
 * (sessao), concluir uma atividade já com detalhes (atividade) ou registrar
 * algo estudado sem ter planejado (avulso). Tudo é opcional, menos o conteúdo.
 */
export function FolhaRegistro({
  sessao,
  atividade,
  preset,
  onFechar,
}: {
  sessao?: SessaoEstudo
  atividade?: Atividade
  preset?: { conteudoId?: string; tipo?: TipoEstudo }
  onFechar: () => void
}) {
  const { hoje, indices } = useAcoes()
  const [conteudoId, setConteudoId] = useState(sessao?.conteudoId ?? atividade?.conteudoId ?? preset?.conteudoId ?? '')
  const [tipo, setTipo] = useState<TipoEstudo>(sessao?.tipo ?? atividade?.tipo ?? preset?.tipo ?? 'estudo')
  const [data, setData] = useState(sessao?.data ?? (atividade && atividade.data < hoje ? atividade.data : hoje))
  const [minutos, setMinutos] = useState(sessao?.minutos?.toString() ?? '')
  const [dificuldade, setDificuldade] = useState<Dificuldade | null>(sessao?.dificuldade ?? null)
  const [observacoes, setObservacoes] = useState(sessao?.observacoes ?? '')
  const conteudo = indices.conteudo.get(conteudoId)
  const [concluir, setConcluir] = useState(false)
  const [erro, setErro] = useState('')
  const fixo = !!sessao || !!atividade

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!conteudoId) return setErro('Escolha o conteúdo.')
    const min = minutos.trim() ? Number(minutos.replace(',', '.')) : null
    if (min !== null && !(min >= 0 && min <= 1440)) return setErro('Tempo em minutos, de 0 a 1440.')
    const detalhes = { minutos: min === null ? null : Math.round(min), dificuldade, observacoes, data, concluirConteudo: concluir }
    if (sessao) await detalharSessao(sessao, detalhes)
    else if (atividade) await concluirAtividade(atividade, detalhes)
    else await registrarSessao(conteudoId, tipo, detalhes)
    onFechar()
  }

  return (
    <Folha
      titulo={sessao ? 'Detalhes do estudo' : 'Registrar estudo'}
      onFechar={onFechar}
      acao={
        <button type="submit" form="form-registro" className="botao-salvar" aria-label="Salvar registro">
          <Icone nome="check" tamanho={22} espessura={2.6} />
        </button>
      }
    >
      <form id="form-registro" className="formulario" onSubmit={enviar}>
        {fixo ? (
          <p className="centro">
            <strong>{conteudo?.nome}</strong>
            <br />
            <span className="sutil">{ROTULO_TIPO[tipo]}</span>
          </p>
        ) : (
          <>
            <SeletorConteudo valor={conteudoId} onMudar={setConteudoId} />
            <AlternadorTipo valor={tipo} onMudar={setTipo} />
          </>
        )}
        <label>
          Data
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value || hoje)} />
        </label>
        <label>
          Tempo estudado (minutos, opcional)
          <input inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="Ex.: 45" />
        </label>
        <div className="chips quebra">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} type="button" className={`chip ${minutos === String(m) ? 'ativo' : ''}`} onClick={() => setMinutos(String(m))}>
              {m} min
            </button>
          ))}
        </div>
        <p className="rotulo-campo">Dificuldade (opcional)</p>
        <div className="alternador tres" role="radiogroup" aria-label="Dificuldade">
          {DIFICULDADES.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={dificuldade === id}
              className={dificuldade === id ? 'ativo' : ''}
              onClick={() => setDificuldade(dificuldade === id ? null : id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <label>
          Observações (opcional)
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={4000} />
        </label>
        {conteudo && conteudo.status !== 'concluido' && (
          <label className="linha-interruptor">
            <span>Conteúdo concluído</span>
            <input type="checkbox" role="switch" className="interruptor" checked={concluir} onChange={(e) => setConcluir(e.target.checked)} />
          </label>
        )}
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="botao primario largo">
          Salvar
        </button>
      </form>
    </Folha>
  )
}

/** Adicionar estudos ou revisões a um dia. Fica aberto para planejar vários seguidos. */
export function FolhaPlanejar({
  preset,
  onFechar,
}: {
  preset?: { conteudoId?: string; tipo?: TipoEstudo; data?: string }
  onFechar: () => void
}) {
  const { hoje, indices } = useAcoes()
  const [conteudoId, setConteudoId] = useState(preset?.conteudoId ?? '')
  const [tipo, setTipo] = useState<TipoEstudo>(preset?.tipo ?? 'estudo')
  const [data, setData] = useState(preset?.data ?? hoje)
  const [adicionados, setAdicionados] = useState<string[]>([])
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!conteudoId) return setErro('Escolha o conteúdo.')
    if (!data) return setErro('Escolha o dia.')
    // Limpa a escolha antes de salvar: quem planeja vários seguidos não perde o próximo.
    if (!preset?.conteudoId) setConteudoId('')
    setErro('')
    const nome = indices.conteudo.get(conteudoId)?.nome ?? ''
    setAdicionados((lista) => [...lista, `${nome} (${ROTULO_TIPO[tipo].toLowerCase()}, ${dataCurta(data)})`])
    await planejar(conteudoId, tipo, data)
  }

  return (
    <Folha titulo={tipo === 'revisao' ? 'Agendar revisão' : 'Planejar estudo'} onFechar={onFechar}>
      <form className="formulario" onSubmit={enviar}>
        <SeletorConteudo valor={conteudoId} onMudar={setConteudoId} />
        <AlternadorTipo valor={tipo} onMudar={setTipo} />
        <label>
          Dia
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <div className="chips quebra">
          {(tipo === 'revisao'
            ? ([
                ['+1 dia', 1],
                ['+7 dias', 7],
                ['+30 dias', 30],
              ] as const)
            : ([
                ['Hoje', 0],
                ['Amanhã', 1],
                ['+7 dias', 7],
              ] as const)
          ).map(([rotulo, n]) => (
            <button key={rotulo} type="button" className={`chip ${data === somarDias(hoje, n) ? 'ativo' : ''}`} onClick={() => setData(somarDias(hoje, n))}>
              {rotulo}
            </button>
          ))}
        </div>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="botao primario largo">
          Adicionar ao planejamento
        </button>
        {adicionados.length > 0 && (
          <>
            <p className="sutil">Adicionados agora:</p>
            <ul className="lista-simples">
              {adicionados.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <button type="button" className="botao largo" onClick={onFechar}>
              Pronto
            </button>
          </>
        )}
      </form>
    </Folha>
  )
}
