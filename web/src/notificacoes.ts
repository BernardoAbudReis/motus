import { useEffect, useState } from 'react'
import { lerToken, requisicao } from './api'
import { ehIOS, estaInstalado } from './instalacao'

/**
 * Lembretes por Web Push. O navegador não agenda notificações sozinho com o
 * app fechado, então quem envia é o servidor (que conhece os hábitos pela
 * sincronização). Por isso é preciso estar com a conta conectada.
 */

export type EstadoNotificacoes =
  | 'sem-suporte' // navegador sem Web Push
  | 'instalar-iphone' // iPhone: só funciona com o app na tela de início
  | 'negado' // usuário bloqueou as notificações
  | 'desligado'
  | 'ligado'

export function suportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function inscricaoAtual() {
  if (!suportaPush()) return null
  const registro = await navigator.serviceWorker.getRegistration()
  return (await registro?.pushManager.getSubscription()) ?? null
}

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  if (ehIOS() && !estaInstalado()) return 'instalar-iphone'
  if (!suportaPush()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'negado'
  return (await inscricaoAtual()) && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

function chaveParaBytes(base64Url: string) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function fusoHorario() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

async function enviarInscricao(inscricao: PushSubscription) {
  await requisicao('/push/inscricoes', {
    method: 'POST',
    body: JSON.stringify({ inscricao: inscricao.toJSON(), fuso: fusoHorario() }),
  })
}

/** Pede permissão, inscreve este aparelho e avisa o servidor. Precisa vir de um toque do usuário. */
export async function ativarNotificacoes() {
  if (ehIOS() && !estaInstalado()) {
    throw new Error('No iPhone, instale o MOTUS na tela de início (iOS 16.4 ou mais novo) e ative por lá.')
  }
  if (!suportaPush()) throw new Error('Este navegador não aceita notificações.')
  if (!(await lerToken())) throw new Error('Entre na sua conta: os lembretes são enviados pelo servidor.')

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('As notificações foram bloqueadas. Libere nas configurações do navegador.')

  const registro = await navigator.serviceWorker.ready
  const { chave } = await requisicao<{ chave: string }>('/push/chave')
  let inscricao = await registro.pushManager.getSubscription()
  if (!inscricao) {
    try {
      inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) })
    } catch {
      throw new Error('Não foi possível ativar as notificações neste navegador.')
    }
  }
  await enviarInscricao(inscricao)
}

export async function desativarNotificacoes() {
  const inscricao = await inscricaoAtual()
  if (!inscricao) return
  await requisicao('/push/inscricoes', { method: 'DELETE', body: JSON.stringify({ endpoint: inscricao.endpoint }) }).catch(() => {})
  await inscricao.unsubscribe()
}

export async function enviarTeste() {
  return requisicao<{ enviadas: number; falhas: number }>('/push/teste', { method: 'POST' })
}

/**
 * Ao abrir o app, reenvia a inscrição deste aparelho (se houver): mantém o
 * fuso horário atualizado (viagens) e repara o caso de o servidor tê-la perdido.
 */
export async function renovarInscricao() {
  try {
    const inscricao = await inscricaoAtual()
    if (inscricao && Notification.permission === 'granted' && (await lerToken())) await enviarInscricao(inscricao)
  } catch {
    // sem conexão: tenta na próxima abertura
  }
}

export function useEstadoNotificacoes() {
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null)
  const atualizar = () => void estadoNotificacoes().then(setEstado)
  useEffect(atualizar, [])
  return { estado, atualizar }
}
