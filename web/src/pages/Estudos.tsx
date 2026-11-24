import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../components/Icone'
import type { Atividade, SessaoEstudo, TipoEstudo } from '../db'
import { ContextoEstudos, indexar, type Acoes } from '../estudos/contexto'
import { concluirAtividade, criarExemploEstudos, desfazerConclusao, useEstudos } from '../estudos/dados'
import { FolhaAtividade, FolhaPlanejar, FolhaRegistro } from '../estudos/Folhas'
import { DetalheConteudo, DetalheMateria, FormConteudo, FormMateria, Materias } from '../estudos/Materias'
import { Hoje, Revisoes, Semana } from '../estudos/Telas'
import { dataLocal } from '../repo'

type Aba = 'hoje' | 'semana' | 'materias' | 'revisoes'

const ABAS: [Aba, string][] = [
  ['hoje', 'Hoje'],
  ['semana', 'Semana'],
  ['materias', 'Matérias'],
  ['revisoes', 'Revisões'],
]

type Painel =
  | { tipo: 'atividade'; id: string }
  | { tipo: 'registro'; sessao?: SessaoEstudo; atividadeId?: string; preset?: { conteudoId?: string; tipo?: TipoEstudo } }
  | { tipo: 'planejar'; preset?: { conteudoId?: string; tipo?: TipoEstudo; data?: string } }
  | { tipo: 'materia'; id: string }
  | { tipo: 'formMateria'; id?: string }
  | { tipo: 'conteudo'; id: string }
  | { tipo: 'formConteudo'; id: string }

/** Hoje, atualizado quando vira o dia com o app aberto. */
function useHoje() {
  const [hoje, setHoje] = useState(dataLocal)
  useEffect(() => {
    const t = setInterval(() => setHoje(dataLocal()), 60_000)
    return () => clearInterval(t)
  }, [])
  return hoje
}

export function Estudos() {
  const dados = useEstudos()
  const hoje = useHoje()
  const [aba, setAba] = useState<Aba>('hoje')
  // Painéis empilhados: o de cima é o último. Fechar volta para o de baixo.
  const [pilha, setPilha] = useState<Painel[]>([])
  const [ultimo, setUltimo] = useState<SessaoEstudo | null>(null)
  const indices = useMemo(() => (dados ? indexar(dados) : null), [dados])

  // Aviso "registrado · adicionar detalhes" some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!ultimo) return
    const t = setTimeout(() => setUltimo(null), 6000)
    return () => clearTimeout(t)
  }, [ultimo])

  if (!dados || !indices) return null

  const abrir = (p: Painel) => setPilha((atual) => [...atual, p])
  const fechar = () => setPilha((atual) => atual.slice(0, -1))

  const acoes: Acoes = {
    dados,
    indices,
    hoje,
    abrirAtividade: (a) => abrir({ tipo: 'atividade', id: a.id }),
    abrirConteudo: (id) => abrir({ tipo: 'conteudo', id }),
    abrirMateria: (id) => abrir({ tipo: 'materia', id }),
    planejar: (preset) => abrir({ tipo: 'planejar', preset }),
    registrar: (preset) => abrir({ tipo: 'registro', preset }),
    concluir: (a: Atividade) => {
      if (a.estado === 'feita') return void desfazerConclusao(a)
      void concluirAtividade(a).then(setUltimo)
    },
  }

  const vazio = dados.materias.length === 0

  function painel(p: Painel, i: number) {
    const chave = `${p.tipo}-${i}`
    switch (p.tipo) {
      case 'atividade': {
        const a = dados!.atividades.find((x) => x.id === p.id)
        return a && <FolhaAtividade key={chave} atividade={a} onFechar={fechar} onDetalhar={() => setPilha((s) => [...s.slice(0, -1), { tipo: 'registro', atividadeId: a.id }])} />
      }
      case 'registro': {
        const atividade = p.atividadeId ? dados!.atividades.find((x) => x.id === p.atividadeId) : undefined
        return <FolhaRegistro key={chave} sessao={p.sessao} atividade={atividade} preset={p.preset} onFechar={fechar} />
      }
      case 'planejar':
        return <FolhaPlanejar key={chave} preset={p.preset} onFechar={fechar} />
      case 'materia': {
        const m = indices!.materia.get(p.id)
        return m && <DetalheMateria key={chave} materia={m} onFechar={fechar} onEditar={() => abrir({ tipo: 'formMateria', id: m.id })} />
      }
      case 'formMateria': {
        const m = p.id ? indices!.materia.get(p.id) : undefined
        return (
          <FormMateria
            key={chave}
            materia={m}
            onFechar={() => setPilha((s) => (m && !indices!.materia.get(m.id) ? [] : s.slice(0, -1)))}
            onCriada={(id) => setPilha((s) => [...s.slice(0, -1), { tipo: 'materia', id }])}
          />
        )
      }
      case 'conteudo': {
        const c = indices!.conteudo.get(p.id)
        return c && <DetalheConteudo key={chave} conteudo={c} onFechar={fechar} onEditar={() => abrir({ tipo: 'formConteudo', id: c.id })} />
      }
      case 'formConteudo': {
        const c = indices!.conteudo.get(p.id)
        return c && <FormConteudo key={chave} conteudo={c} onFechar={fechar} />
      }
    }
  }

  return (
    <ContextoEstudos.Provider value={acoes}>
      <section className="estudos">
        <header className="topo-pagina simples">
          <h1>Estudos</h1>
        </header>

        {vazio ? (
          <div className="vazio">
            <span className="vazio-icone" aria-hidden>
              <Icone nome="estudos" tamanho={30} />
            </span>
            <p className="vazio-titulo">Organize seus estudos</p>
            <p>Cadastre as matérias e os conteúdos, planeje a semana e acompanhe o que já foi estudado e o que falta revisar.</p>
            <button className="botao primario largo" onClick={() => abrir({ tipo: 'formMateria' })}>
              Criar primeira matéria
            </button>
            <button className="botao-link" onClick={() => void criarExemploEstudos()}>
              Adicionar exemplo (JavaScript e Português)
            </button>
          </div>
        ) : (
          <>
            <div className="alternador quatro abas" role="tablist" aria-label="Seções de estudos">
              {ABAS.map(([id, rotulo]) => (
                <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
                  {rotulo}
                </button>
              ))}
            </div>
            {aba === 'hoje' && <Hoje onIrPara={setAba} />}
            {aba === 'semana' && <Semana />}
            {aba === 'materias' && <Materias onNovaMateria={() => abrir({ tipo: 'formMateria' })} />}
            {aba === 'revisoes' && <Revisoes />}
          </>
        )}

        {pilha.map(painel)}

        {ultimo && (
          <div className="aviso" role="status">
            <span>{ultimo.tipo === 'revisao' ? 'Revisão registrada.' : 'Estudo registrado.'}</span>
            <button
              className="botao"
              onClick={() => {
                abrir({ tipo: 'registro', sessao: ultimo })
                setUltimo(null)
              }}
            >
              Adicionar detalhes
            </button>
          </div>
        )}
      </section>
    </ContextoEstudos.Provider>
  )
}
