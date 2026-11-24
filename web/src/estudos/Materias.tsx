import { useState, type CSSProperties, type FormEvent } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import type { Conteudo, Materia, Prioridade, StatusConteudo } from '../db'
import { CORES_HABITO, corDoHabito } from '../habitos/dados'
import { BarraMateria, LinhaAcao, ListaAtividades, Numero, Secao } from './comum'
import { ROTULO_PRIORIDADE, ROTULO_STATUS, ROTULO_TIPO, corMateria, useAcoes } from './contexto'
import {
  atualizarConteudo,
  atualizarMateria,
  criarConteudo,
  criarMateria,
  criarSetor,
  excluirConteudo,
  excluirMateria,
  excluirSessao,
  excluirSetor,
  mudarStatus,
  renomearSetor,
  setorPadrao,
} from './dados'
import { dataCurta, formatarMinutos, materiasDoSetor, minutosEstudados, ordenar, pendente, progressoDaMateria, revisoesDoConteudo, somarDias } from './logica'

const ICONES_MATERIA = ['', '📚', '💻', '🧮', '🧪', '🌎', '🗣️', '✍️', '⚖️', '🩺', '🎵', '📈', '🧠', '🏛️', '🔧', '🎨']

/* ---------- Lista ---------- */

export function Materias({ onNovaMateria }: { onNovaMateria: () => void }) {
  const { dados, abrirMateria } = useAcoes()
  const [setorId, setSetorId] = useState<string | null>(null)
  const [verArquivadas, setVerArquivadas] = useState(false)
  const [gerenciarSetores, setGerenciarSetores] = useState(false)
  const setores = dados.setores.filter((s) => !s.arquivado)
  const lista = verArquivadas ? dados.materias.filter((m) => m.arquivada) : materiasDoSetor(dados.materias, setorId)
  const arquivadas = dados.materias.filter((m) => m.arquivada).length

  return (
    <>
      <div className="titulo-secao">
        <h3>{verArquivadas ? 'Matérias arquivadas' : 'Matérias'}</h3>
        <span className="linha-botoes">
          <button className="botao-link curto" onClick={() => setGerenciarSetores(true)}>
            <Icone nome="setores" tamanho={18} /> Setores
          </button>
          <button className="botao-link curto" onClick={onNovaMateria}>
            <Icone nome="mais" tamanho={18} /> Nova matéria
          </button>
        </span>
      </div>

      {setores.length > 1 && !verArquivadas && (
        <div className="chips rolagem" role="radiogroup" aria-label="Setor">
          <button role="radio" aria-checked={setorId === null} className={`chip ${setorId === null ? 'ativo' : ''}`} onClick={() => setSetorId(null)}>
            Todos
          </button>
          {setores.map((s) => (
            <button key={s.id} role="radio" aria-checked={setorId === s.id} className={`chip ${setorId === s.id ? 'ativo' : ''}`} onClick={() => setSetorId(s.id)}>
              {s.nome}
            </button>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="vazio">
          <p>{verArquivadas ? 'Nenhuma matéria arquivada.' : 'Nenhuma matéria neste setor.'}</p>
          {!verArquivadas && (
            <button className="botao primario largo" onClick={onNovaMateria}>
              Criar matéria
            </button>
          )}
        </div>
      ) : (
        <div className="lista-materias">
          {lista.map((m) => (
            <CartaoMateria key={m.id} materia={m} onAbrir={() => abrirMateria(m.id)} />
          ))}
        </div>
      )}

      {(arquivadas > 0 || verArquivadas) && (
        <button className="botao-link" onClick={() => setVerArquivadas(!verArquivadas)}>
          {verArquivadas ? 'Voltar para as matérias' : `Ver arquivadas (${arquivadas})`}
        </button>
      )}

      {gerenciarSetores && <FolhaSetores onFechar={() => setGerenciarSetores(false)} />}
    </>
  )
}

export function CartaoMateria({ materia: m, onAbrir }: { materia: Materia; onAbrir: () => void }) {
  const { dados } = useAcoes()
  const p = progressoDaMateria(m.id, dados.conteudos, dados.atividades, dados.sessoes)
  const cor = corMateria(m)
  return (
    <button className="cartao-materia" style={{ '--cor': cor } as CSSProperties} onClick={onAbrir}>
      <span className="cartao-materia-topo">
        <strong>
          {m.icone && <span aria-hidden>{m.icone} </span>}
          {m.nome}
        </strong>
        <span className="cartao-materia-pct">{p.percentual}%</span>
      </span>
      <BarraMateria percentual={p.percentual} cor={cor} />
      <span className="sutil">
        {p.total === 0
          ? 'Nenhum conteúdo ainda'
          : `${p.concluidos} de ${p.total} concluídos · ${p.andamento} em andamento${p.revisoesPendentes ? ` · ${p.revisoesPendentes} ${p.revisoesPendentes === 1 ? 'revisão' : 'revisões'}` : ''}`}
      </span>
    </button>
  )
}

/* ---------- Setores ---------- */

function FolhaSetores({ onFechar }: { onFechar: () => void }) {
  const { dados } = useAcoes()
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState('')

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    const nome = novo
    if (!nome.trim()) return
    setNovo('') // limpa antes de salvar: quem digita rápido não perde o próximo
    await criarSetor(nome)
  }

  async function apagar(id: string, nome: string) {
    if (!confirm(`Excluir o setor "${nome}"?`)) return
    try {
      await excluirSetor(id)
      setErro('')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Folha titulo="Setores" onFechar={onFechar}>
      <p className="sutil">Separe os estudos por objetivo: faculdade, concurso, idiomas… Quem não precisa pode deixar tudo em um setor só.</p>
      <div className="lista-setores">
        {dados.setores.map((s) => (
          <div key={s.id} className="linha-setor">
            <input aria-label={`Nome do setor ${s.nome}`} defaultValue={s.nome} maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value !== s.nome && void renomearSetor(s.id, e.target.value)} />
            <span className="sutil">{dados.materias.filter((m) => m.setorId === s.id).length}</span>
            <button className="botao-icone" aria-label={`Excluir setor ${s.nome}`} onClick={() => void apagar(s.id, s.nome)}>
              <Icone nome="lixeira" tamanho={18} />
            </button>
          </div>
        ))}
      </div>
      {erro && <p className="erro">{erro}</p>}
      <form className="linha-adicionar" onSubmit={adicionar}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo setor" aria-label="Novo setor" maxLength={80} />
        <button className="botao primario" type="submit">
          Adicionar
        </button>
      </form>
    </Folha>
  )
}

/* ---------- Formulário de matéria ---------- */

export function FormMateria({ materia, onFechar, onCriada }: { materia?: Materia; onFechar: () => void; onCriada?: (id: string) => void }) {
  const { dados } = useAcoes()
  const [nome, setNome] = useState(materia?.nome ?? '')
  const [setorId, setSetorId] = useState(materia?.setorId ?? dados.setores.find((s) => !s.arquivado)?.id ?? '')
  const [novoSetor, setNovoSetor] = useState('')
  const [cor, setCor] = useState(materia?.cor ?? CORES_HABITO[(dados.materias.length + 2) % CORES_HABITO.length].id)
  const [icone, setIcone] = useState(materia?.icone ?? '')
  const [descricao, setDescricao] = useState(materia?.descricao ?? '')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome à matéria.')
    let setor = setorId
    if (setor === 'novo') {
      if (!novoSetor.trim()) return setErro('Dê um nome ao novo setor.')
      setor = (await criarSetor(novoSetor)).id
    }
    if (!setor) setor = await setorPadrao()
    const campos = { setorId: setor, nome: nome.trim(), cor, icone: icone.trim(), descricao: descricao.trim() }
    if (materia) {
      await atualizarMateria(materia.id, campos)
      return onFechar()
    }
    const m = await criarMateria(campos)
    // Ao criar, o formulário dá lugar ao detalhe da matéria (para já cadastrar os conteúdos).
    if (onCriada) onCriada(m.id)
    else onFechar()
  }

  async function apagar() {
    if (!materia) return
    if (!confirm(`Excluir "${materia.nome}" com todos os conteúdos, o planejamento e o histórico? Para só esconder, use Arquivar.`)) return
    await excluirMateria(materia.id)
    onFechar()
  }

  return (
    <Folha
      titulo={materia ? 'Editar matéria' : 'Nova matéria'}
      onFechar={onFechar}
      acao={
        <button type="submit" form="form-materia" className="botao-salvar" style={{ '--cor': corDoHabito(cor) } as CSSProperties} aria-label="Salvar matéria">
          <Icone nome="check" tamanho={22} espessura={2.6} />
        </button>
      }
    >
      <form id="form-materia" className="formulario" onSubmit={enviar}>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: JavaScript" autoFocus={!materia} />
        </label>
        <label>
          Setor
          <select value={setorId} onChange={(e) => setSetorId(e.target.value)}>
            {dados.setores.length === 0 && <option value="">Geral</option>}
            {dados.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
            <option value="novo">Novo setor…</option>
          </select>
        </label>
        {setorId === 'novo' && (
          <label>
            Nome do novo setor
            <input value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)} maxLength={80} placeholder="Ex.: Concurso" />
          </label>
        )}
        <p className="rotulo-campo">Cor</p>
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
        <p className="rotulo-campo">Ícone (opcional)</p>
        <div className="grade-icones compacta">
          {ICONES_MATERIA.map((i) => (
            <button type="button" key={i || 'nenhum'} className={i === icone ? 'ativo' : ''} aria-label={i || 'Sem ícone'} aria-pressed={i === icone} onClick={() => setIcone(i)}>
              {i || <Icone nome="fechar" tamanho={16} />}
            </button>
          ))}
        </div>
        <label>
          Descrição (opcional)
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
        </label>
        {erro && <p className="erro">{erro}</p>}
        {materia && (
          <div className="lista-agrupada">
            <LinhaAcao
              icone={materia.arquivada ? 'desarquivar' : 'arquivo'}
              rotulo={materia.arquivada ? 'Desarquivar' : 'Arquivar'}
              onClick={async () => {
                await atualizarMateria(materia.id, { arquivada: !materia.arquivada })
                onFechar()
              }}
            />
            <LinhaAcao icone="lixeira" rotulo="Excluir matéria" perigo onClick={() => void apagar()} />
          </div>
        )}
      </form>
    </Folha>
  )
}

/* ---------- Detalhe da matéria ---------- */

const ICONE_STATUS: Record<StatusConteudo, string> = { pendente: '', andamento: '◐', concluido: '✓' }

export function DetalheMateria({ materia: m, onFechar, onEditar }: { materia: Materia; onFechar: () => void; onEditar: () => void }) {
  const { dados, hoje, abrirConteudo, planejar } = useAcoes()
  const [novo, setNovo] = useState('')
  const p = progressoDaMateria(m.id, dados.conteudos, dados.atividades, dados.sessoes)
  const conteudos = dados.conteudos.filter((c) => c.materiaId === m.id)
  const ids = new Set(conteudos.map((c) => c.id))
  const planejadas = ordenar(dados.atividades.filter((a) => ids.has(a.conteudoId) && pendente(a)))
  const historico = dados.sessoes.filter((s) => ids.has(s.conteudoId)).slice(0, 10)
  const nomeConteudo = (id: string) => dados.conteudos.find((c) => c.id === id)?.nome ?? ''
  const cor = corMateria(m)

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    const nome = novo
    if (!nome.trim()) return
    setNovo('') // limpa antes de salvar: quem digita rápido não perde o próximo
    await criarConteudo(m.id, { nome })
  }

  return (
    <Folha
      titulo={m.nome}
      onFechar={onFechar}
      acao={
        <button className="botao-redondo" aria-label="Editar matéria" onClick={onEditar}>
          <Icone nome="editar" tamanho={18} />
        </button>
      }
    >
      <div className="progresso-materia" style={{ '--cor': cor } as CSSProperties}>
        <span className="progresso-materia-pct">{p.percentual}%</span>
        <BarraMateria percentual={p.percentual} cor={cor} />
      </div>
      <div className="resumo quatro">
        <Numero valor={p.concluidos} rotulo="concluídos" />
        <Numero valor={p.andamento} rotulo="em andamento" />
        <Numero valor={p.pendentes} rotulo="pendentes" />
        <Numero valor={p.revisoesPendentes} rotulo="revisões" />
      </div>
      {p.minutos > 0 && <p className="sutil centro">{formatarMinutos(p.minutos)} de estudo registrados</p>}
      {m.descricao && <p className="descricao">{m.descricao}</p>}

      <Secao titulo="Conteúdos">
        {conteudos.length === 0 && <p className="sutil vazio-curto">Adicione os conteúdos que você precisa estudar.</p>}
        <div className="lista-conteudos">
          {conteudos.map((c) => (
            <button key={c.id} className={`linha-conteudo ${c.status}`} onClick={() => abrirConteudo(c.id)}>
              <span className="marca-status" aria-hidden>
                {ICONE_STATUS[c.status]}
              </span>
              <span className="linha-conteudo-nome">{c.nome}</span>
              {c.prioridade === 'alta' && <span className="etiqueta">Prioridade alta</span>}
              <span className="sutil">{ROTULO_STATUS[c.status]}</span>
            </button>
          ))}
        </div>
        <form className="linha-adicionar" onSubmit={adicionar}>
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo conteúdo" aria-label="Novo conteúdo" maxLength={120} />
          <button className="botao primario" type="submit" aria-label="Adicionar conteúdo">
            <Icone nome="mais" tamanho={18} />
          </button>
        </form>
      </Secao>

      <Secao
        titulo="Planejado"
        acao={
          <button className="botao-link curto" onClick={() => planejar({ conteudoId: conteudos[0]?.id })} disabled={conteudos.length === 0}>
            <Icone nome="mais" tamanho={18} /> Planejar
          </button>
        }
      >
        <ListaAtividades atividades={planejadas} vazio="Nada planejado para esta matéria." mostrarData />
      </Secao>

      <Secao titulo="Histórico recente">
        {historico.length === 0 ? (
          <p className="sutil vazio-curto">Nenhum estudo registrado ainda.</p>
        ) : (
          <ul className="lista-simples">
            {historico.map((s) => (
              <li key={s.id}>
                {s.data === hoje ? 'Hoje' : dataCurta(s.data)} · {ROTULO_TIPO[s.tipo]} de {nomeConteudo(s.conteudoId)}
                {s.minutos ? ` · ${formatarMinutos(s.minutos)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </Folha>
  )
}


/* ---------- Detalhe do conteúdo ---------- */

export function DetalheConteudo({ conteudo: c, onFechar, onEditar }: { conteudo: Conteudo; onFechar: () => void; onEditar: () => void }) {
  const { dados, indices, hoje, planejar, registrar } = useAcoes()
  const materia = indices.materia.get(c.materiaId)
  const minutos = minutosEstudados(c.id, dados.sessoes)
  const { ultima, proxima } = revisoesDoConteudo(c.id, dados.atividades, dados.sessoes)
  const planejadas = ordenar(dados.atividades.filter((a) => a.conteudoId === c.id && pendente(a)))
  const sessoes = dados.sessoes.filter((s) => s.conteudoId === c.id)

  return (
    <Folha
      titulo={c.nome}
      onFechar={onFechar}
      acao={
        <button className="botao-redondo" aria-label="Editar conteúdo" onClick={onEditar}>
          <Icone nome="editar" tamanho={18} />
        </button>
      }
    >
      {materia && <p className="sutil centro">{materia.nome}</p>}
      <div className="alternador tres" role="radiogroup" aria-label="Status">
        {(['pendente', 'andamento', 'concluido'] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={c.status === s} className={c.status === s ? 'ativo' : ''} onClick={() => void mudarStatus(c, s)}>
            {ROTULO_STATUS[s]}
          </button>
        ))}
      </div>

      <div className="resumo dois">
        <Numero valor={minutos ? formatarMinutos(minutos) : '—'} rotulo={c.tempoEstimadoMin ? `estudado de ${formatarMinutos(c.tempoEstimadoMin)}` : 'estudado'} />
        <Numero valor={c.concluidoEm ? dataCurta(c.concluidoEm) : '—'} rotulo="concluído em" />
        <Numero valor={ultima ? dataCurta(ultima.data) : '—'} rotulo="última revisão" />
        <Numero valor={proxima ? dataCurta(proxima.data) : '—'} rotulo="próxima revisão" />
      </div>

      <div className="linha-botoes coluna">
        <button className="botao primario largo" onClick={() => registrar({ conteudoId: c.id })}>
          Registrar estudo
        </button>
        <button className="botao largo" onClick={() => planejar({ conteudoId: c.id })}>
          Planejar estudo
        </button>
      </div>

      <h3 className="grupo-titulo">Agendar revisão</h3>
      <div className="chips quebra">
        {[1, 7, 30].map((n) => (
          <button key={n} className="chip" onClick={() => planejar({ conteudoId: c.id, tipo: 'revisao', data: somarDias(hoje, n) })}>
            Em {n} {n === 1 ? 'dia' : 'dias'}
          </button>
        ))}
        <button className="chip" onClick={() => planejar({ conteudoId: c.id, tipo: 'revisao' })}>
          Outra data
        </button>
      </div>

      {(c.descricao || c.observacoes) && (
        <>
          {c.descricao && <p className="descricao">{c.descricao}</p>}
          {c.observacoes && <p className="observacao">{c.observacoes}</p>}
        </>
      )}

      <Secao titulo="Planejado">
        <ListaAtividades atividades={planejadas} vazio="Nada planejado." mostrarData />
      </Secao>

      <Secao titulo="Histórico">
        {sessoes.length === 0 ? (
          <p className="sutil vazio-curto">Nenhum estudo ou revisão registrado.</p>
        ) : (
          <ul className="lista-sessoes-estudo">
            {sessoes.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.data === hoje ? 'Hoje' : dataCurta(s.data)}</strong> · {ROTULO_TIPO[s.tipo]}
                  {s.minutos ? ` · ${formatarMinutos(s.minutos)}` : ''}
                  {s.dificuldade ? ` · ${{ facil: 'fácil', media: 'média', dificil: 'difícil' }[s.dificuldade]}` : ''}
                  {s.observacoes && <span className="sutil bloco">{s.observacoes}</span>}
                </span>
                <button
                  className="botao-icone"
                  aria-label="Excluir registro"
                  onClick={() => confirm('Excluir este registro do histórico?') && void excluirSessao(s.id)}
                >
                  <Icone nome="lixeira" tamanho={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </Folha>
  )
}

/* ---------- Formulário de conteúdo ---------- */

export function FormConteudo({ conteudo: c, onFechar }: { conteudo: Conteudo; onFechar: () => void }) {
  const [nome, setNome] = useState(c.nome)
  const [descricao, setDescricao] = useState(c.descricao)
  const [prioridade, setPrioridade] = useState<Prioridade>(c.prioridade)
  const [estimado, setEstimado] = useState(c.tempoEstimadoMin?.toString() ?? '')
  const [observacoes, setObservacoes] = useState(c.observacoes)
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome ao conteúdo.')
    const min = estimado.trim() ? Number(estimado.replace(',', '.')) : null
    if (min !== null && !(min >= 0)) return setErro('Tempo estimado em minutos.')
    await atualizarConteudo(c.id, {
      nome: nome.trim(),
      descricao: descricao.trim(),
      prioridade,
      tempoEstimadoMin: min === null ? null : Math.round(min),
      observacoes: observacoes.trim(),
    })
    onFechar()
  }

  async function apagar() {
    if (!confirm(`Excluir "${c.nome}" com o planejamento e o histórico dele?`)) return
    await excluirConteudo(c.id)
    onFechar()
  }

  return (
    <Folha
      titulo="Editar conteúdo"
      onFechar={onFechar}
      acao={
        <button type="submit" form="form-conteudo" className="botao-salvar" aria-label="Salvar conteúdo">
          <Icone nome="check" tamanho={22} espessura={2.6} />
        </button>
      }
    >
      <form id="form-conteudo" className="formulario" onSubmit={enviar}>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
        </label>
        <p className="rotulo-campo">Prioridade</p>
        <div className="alternador tres" role="radiogroup" aria-label="Prioridade">
          {(['baixa', 'media', 'alta'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={prioridade === p} className={prioridade === p ? 'ativo' : ''} onClick={() => setPrioridade(p)}>
              {ROTULO_PRIORIDADE[p]}
            </button>
          ))}
        </div>
        <label>
          Tempo estimado (minutos, opcional)
          <input inputMode="numeric" value={estimado} onChange={(e) => setEstimado(e.target.value)} placeholder="Ex.: 120" />
        </label>
        <label>
          Descrição (opcional)
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} />
        </label>
        <label>
          Observações (opcional)
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={4000} />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="botao primario largo">
          Salvar
        </button>
        <div className="lista-agrupada">
          <LinhaAcao icone="lixeira" rotulo="Excluir conteúdo" perigo onClick={() => void apagar()} />
        </div>
      </form>
    </Folha>
  )
}
