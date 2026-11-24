import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import { pool } from './banco.js'

/**
 * Lembretes de hábitos. A cada minuto, para cada usuário com aparelho
 * inscrito, vê quais hábitos estão agendados para hoje (no fuso do aparelho),
 * ainda não foram concluídos e já passaram do horário do lembrete. O horário é
 * a média circular das últimas conclusões (mesma conta de web/src/habitos/lembrete.ts).
 */

const MINIMO_CONCLUSOES = 3
const MAXIMO_CONCLUSOES = 20
/** Se o servidor ficou fora do ar, ainda avisa até 45 min depois do horário. */
const JANELA_MIN = 45
const LEMBRETE_PADRAO = { ativo: true, modo: 'auto' as 'auto' | 'fixo', horario: '20:00' }

// ---------- Contas puras (testáveis sem banco) ----------

export function mediaCircular(minutos: number[]): number | null {
  if (minutos.length === 0) return null
  let x = 0
  let y = 0
  for (const m of minutos) {
    const a = (m / 1440) * 2 * Math.PI
    x += Math.cos(a)
    y += Math.sin(a)
  }
  if (Math.hypot(x, y) < 1e-9) return null
  let a = Math.atan2(y, x)
  if (a < 0) a += 2 * Math.PI
  return Math.round((a / (2 * Math.PI)) * 1440) % 1440
}

function horarioParaMinutos(h: string) {
  const [hh, mm] = h.split(':').map(Number)
  return ((hh || 0) * 60 + (mm || 0)) % 1440
}

function minutosParaHorario(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Data (AAAA-MM-DD) e minutos do dia de um instante, no fuso informado. */
export function relogioNoFuso(ms: number, fuso: string) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  )
  return { data: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) }
}

export function fusoValido(fuso: string) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso })
    return true
  } catch {
    return false
  }
}

export interface HabitoDados {
  nome: string
  icone?: string
  frequencia: { tipo: 'diaria' } | { tipo: 'dias'; dias: number[] }
  arquivado?: boolean
  criadoEm: number
  lembrete?: { ativo?: boolean; modo?: 'auto' | 'fixo'; horario?: string }
}

export interface RegistroDados {
  habitoId: string
  data: string
  concluido: boolean
  concluidoEm?: number | null
}

export interface Lembrete {
  habitoId: string
  titulo: string
  corpo: string
}

/** Quais lembretes devem sair agora para um usuário (sem considerar os já enviados). */
export function lembretesDevidos(
  habitos: { id: string; dados: HabitoDados }[],
  registros: RegistroDados[],
  agora: number,
  fuso: string,
): Lembrete[] {
  const { data: hoje, minutos: agoraMin } = relogioNoFuso(agora, fuso)
  const [a, m, d] = hoje.split('-').map(Number)
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  const devidos: Lembrete[] = []

  for (const { id, dados: h } of habitos) {
    const lembrete = { ...LEMBRETE_PADRAO, ...h.lembrete }
    if (h.arquivado || !lembrete.ativo) continue
    if (h.frequencia.tipo === 'dias' && !h.frequencia.dias.includes(diaSemana)) continue
    if (relogioNoFuso(h.criadoEm, fuso).data > hoje) continue

    const doHabito = registros.filter((r) => r.habitoId === id)
    if (doHabito.some((r) => r.data === hoje && r.concluido)) continue

    const conclusoes = doHabito
      .filter((r) => r.concluido && typeof r.concluidoEm === 'number')
      .map((r) => r.concluidoEm as number)
      .sort((x, y) => y - x)
      .slice(0, MAXIMO_CONCLUSOES)
    const media =
      lembrete.modo === 'auto' && conclusoes.length >= MINIMO_CONCLUSOES
        ? mediaCircular(conclusoes.map((ms) => relogioNoFuso(ms, fuso).minutos))
        : null
    const alvo = media ?? horarioParaMinutos(lembrete.horario)

    // Dentro da janela [alvo, alvo + JANELA). Não volta para o dia anterior.
    if (agoraMin < alvo || agoraMin >= alvo + JANELA_MIN) continue

    devidos.push({
      habitoId: id,
      titulo: `${h.icone ? `${h.icone} ` : ''}${h.nome}`,
      corpo:
        media !== null
          ? `Você costuma fazer por volta das ${minutosParaHorario(media)}. Ainda dá tempo hoje!`
          : 'Ainda não foi feito hoje. Bora manter a sequência?',
    })
  }
  return devidos
}

// ---------- Envio ----------

let configurado = false

/**
 * Liga o envio se as chaves VAPID estiverem definidas. Configuração inválida
 * só desliga os lembretes (com aviso no log): nunca derruba o servidor.
 */
export function configurarPush() {
  const publica = process.env.VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return false
  // Contato exigido pelos serviços de push (https: ou mailto:). No Railway, o próprio domínio público.
  const contato =
    process.env.VAPID_SUBJECT ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'https://localhost')
  try {
    setVapidDetails(contato, publica, privada)
  } catch (e) {
    console.error('Lembretes desligados: configuração VAPID inválida.', (e as Error).message)
    return false
  }
  configurado = true
  return true
}

export function pushDisponivel() {
  return configurado
}

interface Inscricao {
  endpoint: string
  p256dh: string
  auth: string
}

/** Envia para todos os aparelhos do usuário. Inscrições expiradas (404/410) são apagadas (não contam como falha). */
export async function enviarParaUsuario(usuarioId: string, conteudo: { titulo: string; corpo: string; tag?: string; url?: string }) {
  const { rows } = await pool.query<Inscricao>('select endpoint, p256dh, auth from push_inscricoes where usuario_id = $1', [usuarioId])
  let enviadas = 0
  let falhas = 0
  for (const i of rows) {
    try {
      await sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(conteudo), {
        TTL: JANELA_MIN * 60,
        urgency: 'high',
      })
      enviadas++
    } catch (e) {
      if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
        await pool.query('delete from push_inscricoes where endpoint = $1', [i.endpoint])
      } else {
        falhas++
        console.error('Falha ao enviar lembrete:', (e as Error).message)
      }
    }
  }
  return { enviadas, falhas }
}

/** Uma rodada do agendador. Exportada para os testes. */
export async function verificarLembretes(
  agora = Date.now(),
  enviar: (usuarioId: string, conteudo: { titulo: string; corpo: string; tag?: string; url?: string }) => Promise<number> = async (u, c) =>
    (await enviarParaUsuario(u, c)).enviadas,
) {
  const usuarios = await pool.query<{ usuario_id: string; fuso: string }>(
    `select distinct on (usuario_id) usuario_id, fuso from push_inscricoes order by usuario_id, atualizado_em desc`,
  )
  let enviados = 0
  for (const { usuario_id: usuarioId, fuso } of usuarios.rows) {
    const habitos = await pool.query<{ id: string; dados: HabitoDados }>(
      `select id, dados from registros where usuario_id = $1 and colecao = 'habitos' and excluido_em is null`,
      [usuarioId],
    )
    if (habitos.rows.length === 0) continue
    const desde = relogioNoFuso(agora - 60 * 86_400_000, fuso).data
    const registros = await pool.query<{ dados: RegistroDados }>(
      `select dados from registros where usuario_id = $1 and colecao = 'registrosHabito' and excluido_em is null and dados->>'data' >= $2`,
      [usuarioId, desde],
    )
    const hoje = relogioNoFuso(agora, fuso).data
    for (const l of lembretesDevidos(habitos.rows, registros.rows.map((r) => r.dados), agora, fuso)) {
      const novo = await pool.query(
        `insert into lembretes_enviados (usuario_id, habito_id, data) values ($1, $2, $3) on conflict do nothing returning 1`,
        [usuarioId, l.habitoId, hoje],
      )
      if (novo.rowCount === 0) continue // já avisado hoje
      enviados += await enviar(usuarioId, { titulo: l.titulo, corpo: l.corpo, tag: `habito-${l.habitoId}`, url: "/#habitos" })
    }
  }
  return enviados
}

/** Roda no início de cada minuto. Limpa o controle de enviados com mais de 60 dias uma vez por dia. */
export function iniciarAgendador() {
  if (!configurarPush()) {
    console.warn('Lembretes desligados: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.')
    return
  }
  let ultimaLimpeza = 0
  const rodada = async () => {
    try {
      await verificarLembretes()
      if (Date.now() - ultimaLimpeza > 86_400_000) {
        ultimaLimpeza = Date.now()
        await pool.query(`delete from lembretes_enviados where enviado_em < now() - interval '60 days'`)
      }
    } catch (e) {
      console.error('Erro no agendador de lembretes:', (e as Error).message)
    }
  }
  setTimeout(() => {
    void rodada()
    setInterval(() => void rodada(), 60_000)
  }, 60_000 - (Date.now() % 60_000))
  console.log('Agendador de lembretes ligado.')
}
