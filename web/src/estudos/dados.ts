import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Atividade, type Conteudo, type Dificuldade, type Materia, type SessaoEstudo, type Setor, type TipoEstudo } from '../db'
import { alterar, ativos, dataLocal, excluir, novoId, salvar } from '../repo'
import { proximaOrdem, reagendar, statusAposEstudo } from './logica'

export interface DadosEstudos {
  setores: Setor[]
  materias: Materia[]
  conteudos: Conteudo[]
  atividades: Atividade[]
  sessoes: SessaoEstudo[]
}

/** Tudo de Estudos de uma vez (volumes pequenos: algumas centenas de registros). */
export function useEstudos(): DadosEstudos | undefined {
  return useLiveQuery(async () => {
    const [setores, materias, conteudos, atividades, sessoes] = await Promise.all([
      db.setores.toArray(),
      db.materias.toArray(),
      db.conteudos.toArray(),
      db.atividades.toArray(),
      db.sessoesEstudo.toArray(),
    ])
    return {
      setores: ativos(setores).sort((a, b) => a.ordem - b.ordem),
      materias: ativos(materias).sort((a, b) => a.ordem - b.ordem),
      conteudos: ativos(conteudos).sort((a, b) => a.ordem - b.ordem),
      atividades: ativos(atividades),
      sessoes: ativos(sessoes).sort((a, b) => b.data.localeCompare(a.data) || b.updatedAt - a.updatedAt),
    }
  }, [])
}

/* ---------- Setores ---------- */

export const NOME_SETOR_PADRAO = 'Geral'

/** Quem não quer separar por setor usa o "Geral", criado sozinho. */
export async function setorPadrao(): Promise<string> {
  const existentes = ativos(await db.setores.toArray()).filter((s) => !s.arquivado)
  if (existentes.length > 0) return existentes.sort((a, b) => a.ordem - b.ordem)[0].id
  return (await criarSetor(NOME_SETOR_PADRAO)).id
}

export async function criarSetor(nome: string) {
  const ordem = (await db.setores.count()) + 1
  return salvar<Setor>('setores', novoId(), { nome: nome.trim(), ordem, arquivado: false })
}

export async function renomearSetor(id: string, nome: string) {
  await alterar<Setor>('setores', id, { nome: nome.trim() })
}

/** Só setores sem matérias podem ser excluídos (nada de histórico some junto). */
export async function excluirSetor(id: string) {
  const materias = ativos(await db.materias.where('setorId').equals(id).toArray())
  if (materias.length > 0) throw new Error('Mova ou exclua as matérias deste setor antes.')
  await excluir('setores', id)
}

/* ---------- Matérias ---------- */

export type CamposMateria = Pick<Materia, 'setorId' | 'nome' | 'cor' | 'icone' | 'descricao'>

export async function criarMateria(campos: CamposMateria) {
  const ordem = (await db.materias.count()) + 1
  return salvar<Materia>('materias', novoId(), { ...campos, ordem, arquivada: false })
}

export async function atualizarMateria(id: string, campos: Partial<CamposMateria & { arquivada: boolean }>) {
  await alterar<Materia>('materias', id, campos)
}

/** Exclui a matéria com conteúdos, planejamento e histórico (pede confirmação na tela). */
export async function excluirMateria(id: string) {
  const conteudos = ativos(await db.conteudos.where('materiaId').equals(id).toArray())
  for (const c of conteudos) await excluirConteudo(c.id)
  await excluir('materias', id)
}

/* ---------- Conteúdos ---------- */

export type CamposConteudo = Pick<Conteudo, 'nome' | 'descricao' | 'prioridade' | 'tempoEstimadoMin' | 'observacoes'>

export async function criarConteudo(materiaId: string, campos: Partial<CamposConteudo> & { nome: string }) {
  const ordem = (await db.conteudos.where('materiaId').equals(materiaId).count()) + 1
  return salvar<Conteudo>('conteudos', novoId(), {
    materiaId,
    descricao: '',
    prioridade: 'media',
    tempoEstimadoMin: null,
    observacoes: '',
    ...campos,
    nome: campos.nome.trim(),
    ordem,
    status: 'pendente',
    concluidoEm: null,
  })
}

export async function atualizarConteudo(id: string, campos: Partial<CamposConteudo>) {
  await alterar<Conteudo>('conteudos', id, campos)
}

export async function mudarStatus(c: Conteudo, status: Conteudo['status']) {
  await alterar<Conteudo>('conteudos', c.id, {
    status,
    concluidoEm: status === 'concluido' ? (c.concluidoEm ?? dataLocal()) : null,
  })
}

export async function excluirConteudo(id: string) {
  const [atividades, sessoes] = await Promise.all([
    db.atividades.where('conteudoId').equals(id).toArray(),
    db.sessoesEstudo.where('conteudoId').equals(id).toArray(),
  ])
  for (const a of ativos(atividades)) await excluir('atividades', a.id)
  for (const s of ativos(sessoes)) await excluir('sessoesEstudo', s.id)
  await excluir('conteudos', id)
}

/* ---------- Planejamento ---------- */

export async function planejar(conteudoId: string, tipo: TipoEstudo, data: string) {
  const doDia = ativos(await db.atividades.where('data').equals(data).toArray())
  return salvar<Atividade>('atividades', novoId(), {
    conteudoId,
    tipo,
    data,
    dataOriginal: data,
    ordem: proximaOrdem(doDia, data),
    estado: 'planejada',
    reagendamentos: [],
    feitaEm: null,
  })
}

export async function reagendarAtividade(a: Atividade, para: string) {
  if (para === a.data) return
  const doDia = ativos(await db.atividades.where('data').equals(para).toArray())
  await alterar<Atividade>('atividades', a.id, { ...reagendar(a, para), ordem: proximaOrdem(doDia, para) })
}

/** Sai do planejamento, mas continua no histórico da semana como "removida". */
export async function removerAtividade(a: Atividade) {
  await alterar<Atividade>('atividades', a.id, { estado: 'removida' })
}

export async function restaurarAtividade(a: Atividade) {
  await alterar<Atividade>('atividades', a.id, { estado: 'planejada' })
}

/** Troca de lugar com a vizinha do mesmo dia (para cima: -1; para baixo: +1). */
export async function moverNaOrdem(a: Atividade, doDia: Atividade[], direcao: -1 | 1) {
  const i = doDia.findIndex((x) => x.id === a.id)
  const vizinha = doDia[i + direcao]
  if (!vizinha) return
  // Ordens podem empatar (dois aparelhos); renumera o dia inteiro na nova ordem.
  const nova = [...doDia]
  nova[i] = vizinha
  nova[i + direcao] = a
  for (const [ordem, x] of nova.entries()) if (x.ordem !== ordem) await alterar<Atividade>('atividades', x.id, { ordem })
}

/* ---------- Execução ---------- */

export interface Detalhes {
  minutos?: number | null
  dificuldade?: Dificuldade | null
  observacoes?: string
  data?: string
  concluirConteudo?: boolean
}

/** Marca a atividade como feita e registra a sessão (um toque, detalhes opcionais). */
export async function concluirAtividade(a: Atividade, detalhes: Detalhes = {}) {
  const sessao = await registrarSessao(a.conteudoId, a.tipo, { ...detalhes, data: detalhes.data ?? a.data }, a.id)
  await alterar<Atividade>('atividades', a.id, { estado: 'feita', feitaEm: Date.now() })
  return sessao
}

/** Desfaz a conclusão: volta a ficar planejada e a sessão criada pelo toque some. */
export async function desfazerConclusao(a: Atividade) {
  const sessoes = ativos(await db.sessoesEstudo.where('conteudoId').equals(a.conteudoId).toArray()).filter((s) => s.atividadeId === a.id)
  for (const s of sessoes) await excluir('sessoesEstudo', s.id)
  await alterar<Atividade>('atividades', a.id, { estado: 'planejada', feitaEm: null })
}

/** Registra um estudo ou revisão (planejado ou não) e ajusta o status do conteúdo. */
export async function registrarSessao(conteudoId: string, tipo: TipoEstudo, d: Detalhes = {}, atividadeId: string | null = null) {
  const sessao = await salvar<SessaoEstudo>('sessoesEstudo', novoId(), {
    conteudoId,
    tipo,
    data: d.data ?? dataLocal(),
    minutos: d.minutos ?? null,
    dificuldade: d.dificuldade ?? null,
    observacoes: d.observacoes?.trim() ?? '',
    atividadeId,
  })
  const c = await db.conteudos.get(conteudoId)
  if (c) {
    const status = statusAposEstudo(c.status, tipo, !!d.concluirConteudo)
    if (status !== c.status) await mudarStatus(c, status)
  }
  return sessao
}

/** Completa a sessão criada pelo toque rápido com os detalhes informados depois. */
export async function detalharSessao(s: SessaoEstudo, d: Detalhes) {
  await alterar<SessaoEstudo>('sessoesEstudo', s.id, {
    minutos: d.minutos ?? null,
    dificuldade: d.dificuldade ?? null,
    observacoes: d.observacoes?.trim() ?? '',
    ...(d.data ? { data: d.data } : {}),
  })
  if (d.concluirConteudo) {
    const c = await db.conteudos.get(s.conteudoId)
    if (c && c.status !== 'concluido') await mudarStatus(c, 'concluido')
  }
}

export async function excluirSessao(id: string) {
  await excluir('sessoesEstudo', id)
}

/* ---------- Exemplo ---------- */

/** Matérias de exemplo com uma semana planejada, para conhecer a divisão. */
export async function criarExemploEstudos() {
  const setorId = await setorPadrao()
  const hoje = dataLocal()
  const js = await criarMateria({ setorId, nome: 'JavaScript', cor: 'limao', icone: '💻', descricao: '' })
  const pt = await criarMateria({ setorId, nome: 'Português', cor: 'coral', icone: '📚', descricao: '' })
  const arrays = await criarConteudo(js.id, { nome: 'Arrays', prioridade: 'alta' })
  const objetos = await criarConteudo(js.id, { nome: 'Objetos' })
  await criarConteudo(js.id, { nome: 'Promises' })
  const crase = await criarConteudo(pt.id, { nome: 'Crase' })
  const interpretacao = await criarConteudo(pt.id, { nome: 'Interpretação de texto' })
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  const depois = new Date()
  depois.setDate(depois.getDate() + 2)
  await planejar(arrays.id, 'estudo', hoje)
  await planejar(crase.id, 'estudo', hoje)
  await planejar(objetos.id, 'estudo', dataLocal(amanha))
  await planejar(interpretacao.id, 'estudo', dataLocal(depois))
  await planejar(arrays.id, 'revisao', dataLocal(depois))
}
