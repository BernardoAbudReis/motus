import type { Atividade, Conteudo, Materia, SessaoEstudo, StatusConteudo, TipoEstudo } from '../db'
import { inicioDaSemana, lerData, somarDias } from '../habitos/logica'

export { inicioDaSemana, lerData, somarDias }

/** Os 7 dias (segunda a domingo) da semana que começa em `inicio`. */
export function diasDaSemana(inicio: string) {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
}

/** Planejada e ainda não feita: o que aparece como pendente. */
export function pendente(a: Atividade) {
  return a.estado === 'planejada'
}

/** Passou do dia sem ser feita. Nunca é concluída nem apagada sozinha. */
export function atrasada(a: Atividade, hoje: string) {
  return a.estado === 'planejada' && a.data < hoje
}

/** Atividades que contam no planejamento (removidas ficam só no histórico). */
export function visiveis(atividades: Atividade[]) {
  return atividades.filter((a) => a.estado !== 'removida')
}

export function ordenar(atividades: Atividade[]) {
  return [...atividades].sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem)
}

export function doDia(atividades: Atividade[], dia: string) {
  return ordenar(visiveis(atividades).filter((a) => a.data === dia))
}

export function atrasadas(atividades: Atividade[], hoje: string) {
  return ordenar(atividades.filter((a) => atrasada(a, hoje)))
}

/** Ordem para pôr uma atividade no fim do dia. */
export function proximaOrdem(atividades: Atividade[], dia: string) {
  return visiveis(atividades)
    .filter((a) => a.data === dia)
    .reduce((m, a) => Math.max(m, a.ordem + 1), 0)
}

export function percentual(feitas: number, total: number) {
  return total === 0 ? 0 : Math.round((feitas / total) * 100)
}

export interface ResumoSemana {
  planejadas: number
  feitas: number
  pendentes: number
  naoRealizadas: number // pendentes de dias que já passaram
  removidas: number
  reagendadas: Atividade[] // saíram de um dia desta semana para outro dia
  percentual: number
  conteudosEstudados: number
  revisoesFeitas: number
  minutos: number
}

/**
 * O que foi planejado e o que foi feito numa semana. A semana não é guardada:
 * sai das datas das atividades e sessões, então nenhuma semana se perde.
 */
export function resumirSemana(atividades: Atividade[], sessoes: SessaoEstudo[], inicio: string, hoje: string): ResumoSemana {
  const fim = somarDias(inicio, 6)
  const naSemana = (d: string) => d >= inicio && d <= fim
  const daSemana = atividades.filter((a) => naSemana(a.data))
  const contam = visiveis(daSemana)
  const feitas = contam.filter((a) => a.estado === 'feita').length
  const sessoesSemana = sessoes.filter((s) => naSemana(s.data))
  return {
    planejadas: contam.length,
    feitas,
    pendentes: contam.filter(pendente).length,
    naoRealizadas: contam.filter((a) => atrasada(a, hoje)).length,
    removidas: daSemana.length - contam.length,
    reagendadas: atividades.filter((a) => a.reagendamentos.some((r) => naSemana(r.de) && r.para !== r.de)),
    percentual: percentual(feitas, contam.length),
    conteudosEstudados: new Set(sessoesSemana.filter((s) => s.tipo === 'estudo').map((s) => s.conteudoId)).size,
    revisoesFeitas: sessoesSemana.filter((s) => s.tipo === 'revisao').length,
    minutos: sessoesSemana.reduce((t, s) => t + (s.minutos ?? 0), 0),
  }
}

export interface ProgressoMateria {
  total: number
  concluidos: number
  andamento: number
  pendentes: number
  percentual: number
  revisoesPendentes: number
  minutos: number
}

/** Calculado na hora a partir dos conteúdos: nunca fica desatualizado. */
export function progressoDaMateria(
  materiaId: string,
  conteudos: Conteudo[],
  atividades: Atividade[],
  sessoes: SessaoEstudo[],
): ProgressoMateria {
  const daMateria = conteudos.filter((c) => c.materiaId === materiaId)
  const ids = new Set(daMateria.map((c) => c.id))
  const contar = (s: StatusConteudo) => daMateria.filter((c) => c.status === s).length
  const concluidos = contar('concluido')
  return {
    total: daMateria.length,
    concluidos,
    andamento: contar('andamento'),
    pendentes: contar('pendente'),
    percentual: percentual(concluidos, daMateria.length),
    revisoesPendentes: atividades.filter((a) => ids.has(a.conteudoId) && a.tipo === 'revisao' && pendente(a)).length,
    minutos: sessoes.filter((s) => ids.has(s.conteudoId)).reduce((t, s) => t + (s.minutos ?? 0), 0),
  }
}

export function minutosEstudados(conteudoId: string, sessoes: SessaoEstudo[]) {
  return sessoes.filter((s) => s.conteudoId === conteudoId).reduce((t, s) => t + (s.minutos ?? 0), 0)
}

export interface Revisoes {
  atrasadas: Atividade[]
  hoje: Atividade[]
  proximas: Atividade[]
}

/** Revisões planejadas, separadas pelo dia. Independentes do status do conteúdo. */
export function separarRevisoes(atividades: Atividade[], hoje: string): Revisoes {
  const planejadas = ordenar(atividades.filter((a) => a.tipo === 'revisao' && pendente(a)))
  return {
    atrasadas: planejadas.filter((a) => a.data < hoje),
    hoje: planejadas.filter((a) => a.data === hoje),
    proximas: planejadas.filter((a) => a.data > hoje),
  }
}

/** Última revisão feita e próxima planejada de um conteúdo. */
export function revisoesDoConteudo(conteudoId: string, atividades: Atividade[], sessoes: SessaoEstudo[]) {
  const ultima = sessoes
    .filter((s) => s.conteudoId === conteudoId && s.tipo === 'revisao')
    .reduce<SessaoEstudo | null>((m, s) => (!m || s.data > m.data ? s : m), null)
  const proxima = ordenar(atividades.filter((a) => a.conteudoId === conteudoId && a.tipo === 'revisao' && pendente(a)))[0] ?? null
  return { ultima, proxima }
}

/**
 * Status depois de registrar um estudo: o primeiro estudo tira de "pendente"
 * (isso só reflete o que foi feito). "Concluído" é sempre escolha do usuário.
 */
export function statusAposEstudo(atual: StatusConteudo, tipo: TipoEstudo, concluir: boolean): StatusConteudo {
  if (concluir) return 'concluido'
  if (tipo === 'estudo' && atual === 'pendente') return 'andamento'
  return atual
}

/** Muda a data guardando de onde veio. A data original nunca é alterada. */
export function reagendar(a: Atividade, para: string, agora = Date.now()): Pick<Atividade, 'data' | 'reagendamentos'> {
  if (para === a.data) return { data: a.data, reagendamentos: a.reagendamentos }
  return { data: para, reagendamentos: [...a.reagendamentos, { de: a.data, para, em: agora }] }
}

export function formatarMinutos(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function nomeDoDia(dia: string, hoje: string) {
  if (dia === hoje) return 'Hoje'
  if (dia === somarDias(hoje, 1)) return 'Amanhã'
  if (dia === somarDias(hoje, -1)) return 'Ontem'
  const d = lerData(dia)
  const t = `${SEMANA[d.getDay()]}, ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function dataCurta(dia: string) {
  const d = lerData(dia)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function descreverSemana(inicio: string, hoje: string) {
  const atual = inicioDaSemana(hoje)
  if (inicio === atual) return 'Esta semana'
  if (inicio === somarDias(atual, -7)) return 'Semana passada'
  if (inicio === somarDias(atual, 7)) return 'Próxima semana'
  return `${dataCurta(inicio)} a ${dataCurta(somarDias(inicio, 6))}`
}

/** Matérias ativas na ordem, com as do setor escolhido (null = todos). */
export function materiasDoSetor(materias: Materia[], setorId: string | null) {
  return materias.filter((m) => !m.arquivada && (setorId === null || m.setorId === setorId)).sort((a, b) => a.ordem - b.ordem)
}
