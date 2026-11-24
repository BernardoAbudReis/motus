import type { Exercicio, ExercicioSessao, Ficha, SerieRealizada, SessaoTreino } from '../db'

type CamposSessao = Omit<SessaoTreino, 'id' | 'updatedAt' | 'deletedAt' | 'dirty'>

export function finalizadas(sessoes: SessaoTreino[]) {
  return sessoes
    .filter((s) => s.deletedAt === null && s.finalizadaEm !== null)
    .sort((a, b) => b.iniciadaEm - a.iniciadaEm)
}

/** Séries concluídas da última vez que o exercício foi feito (treinos finalizados). */
export function ultimoDesempenho(exercicioId: string, sessoes: SessaoTreino[]): SerieRealizada[] | null {
  for (const s of finalizadas(sessoes)) {
    for (const e of s.exercicios) {
      if (e.exercicioId !== exercicioId) continue
      const feitas = e.series.filter((x) => x.concluida)
      if (feitas.length) return feitas
    }
  }
  return null
}

/**
 * Cria o treino a partir da ficha, copiando nome, grupo e configuração de cada
 * exercício (snapshot): editar a ficha depois não altera este treino.
 * O peso de cada série vem da última vez que o exercício foi feito; sem
 * histórico, vem do peso inicial da ficha.
 */
export function criarSessao(
  ficha: Ficha,
  exerciciosPorId: Map<string, Exercicio>,
  sessoesAnteriores: SessaoTreino[],
  agora = Date.now(),
): CamposSessao {
  const exercicios: ExercicioSessao[] = ficha.itens.map((item) => {
    const ex = exerciciosPorId.get(item.exercicioId)
    const anterior = ultimoDesempenho(item.exercicioId, sessoesAnteriores)
    const series = Array.from({ length: Math.max(1, item.series) }, (_, i) => {
      const ref = anterior?.[i] ?? anterior?.[anterior.length - 1]
      return { peso: ref?.peso ?? item.peso, repeticoes: item.repeticoes, concluida: false }
    })
    return {
      exercicioId: item.exercicioId,
      nome: ex?.nome ?? 'Exercício removido',
      grupoMuscular: ex?.grupoMuscular ?? '',
      equipamento: ex?.equipamento ?? '',
      repeticoesPlanejadas: item.repeticoes,
      descansoSeg: item.descansoSeg,
      observacoes: item.observacoes,
      series,
    }
  })
  return {
    fichaId: ficha.id,
    fichaNome: ficha.nome,
    iniciadaEm: agora,
    finalizadaEm: null,
    duracaoSeg: 0,
    observacoes: '',
    exercicios,
  }
}

export interface Resumo {
  seriesFeitas: number
  seriesTotal: number
  exerciciosFeitos: number
  volume: number // soma de peso × repetições das séries concluídas
}

export function resumir(s: Pick<SessaoTreino, 'exercicios'>): Resumo {
  let seriesFeitas = 0
  let seriesTotal = 0
  let exerciciosFeitos = 0
  let volume = 0
  for (const e of s.exercicios) {
    let algum = false
    for (const x of e.series) {
      seriesTotal++
      if (!x.concluida) continue
      algum = true
      seriesFeitas++
      volume += x.peso * x.repeticoes
    }
    if (algum) exerciciosFeitos++
  }
  return { seriesFeitas, seriesTotal, exerciciosFeitos, volume }
}

export interface PontoEvolucao {
  sessaoId: string
  data: number
  cargaMax: number
  repsNaCargaMax: number
  volume: number
  series: SerieRealizada[]
}

/** Uma entrada por treino finalizado com o exercício, da mais antiga para a mais recente. */
export function evolucao(exercicioId: string, sessoes: SessaoTreino[]): PontoEvolucao[] {
  const pontos: PontoEvolucao[] = []
  for (const s of finalizadas(sessoes)) {
    const feitas = s.exercicios.filter((e) => e.exercicioId === exercicioId).flatMap((e) => e.series.filter((x) => x.concluida))
    if (!feitas.length) continue
    const melhor = feitas.reduce((a, b) => (b.peso > a.peso || (b.peso === a.peso && b.repeticoes > a.repeticoes) ? b : a))
    pontos.push({
      sessaoId: s.id,
      data: s.iniciadaEm,
      cargaMax: melhor.peso,
      repsNaCargaMax: melhor.repeticoes,
      volume: feitas.reduce((t, x) => t + x.peso * x.repeticoes, 0),
      series: feitas,
    })
  }
  return pontos.reverse()
}

export function treinosNoPeriodo(sessoes: SessaoTreino[], de: number, ate: number) {
  return finalizadas(sessoes).filter((s) => s.iniciadaEm >= de && s.iniciadaEm < ate).length
}

/** Segunda-feira 00:00 da semana do instante dado. */
export function inicioDaSemanaMs(agora = Date.now()) {
  const d = new Date(agora)
  const dia = d.getDay()
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function gruposDaFicha(itens: Ficha['itens'], exerciciosPorId: Map<string, Exercicio>) {
  const grupos: string[] = []
  for (const i of itens) {
    const g = exerciciosPorId.get(i.exercicioId)?.grupoMuscular
    if (g && !grupos.includes(g)) grupos.push(g)
  }
  return grupos
}

export function numero(n: number, casas = 1) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

export function formatarPeso(kg: number) {
  return `${numero(kg)} kg`
}

export function formatarVolume(kg: number) {
  return kg >= 10_000 ? `${numero(kg / 1000)} t` : `${numero(kg, 0)} kg`
}

export function formatarDuracaoLonga(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.round((seg % 3600) / 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

/** Aceita "22,5" ou "22.5". Devolve null se não for número válido. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
