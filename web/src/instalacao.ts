/**
 * Instalação na tela inicial.
 * - Android/Chrome e desktop (Chrome/Edge): o navegador dispara
 *   `beforeinstallprompt`; guardamos o evento e mostramos um botão "Instalar".
 * - iPhone/Safari: não existe esse evento; mostramos o passo a passo
 *   Compartilhar > Adicionar à Tela de Início.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: BeforeInstallPromptEvent | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

export function capturarEventoInstalacao() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoGuardado = e as BeforeInstallPromptEvent
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    eventoGuardado = null
    avisar()
  })
}

export function ouvirInstalacao(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

export function podeInstalarDireto() {
  return eventoGuardado !== null
}

export async function instalar() {
  if (!eventoGuardado) return false
  await eventoGuardado.prompt()
  const { outcome } = await eventoGuardado.userChoice
  eventoGuardado = null
  avisar()
  return outcome === 'accepted'
}

export function estaInstalado() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function ehIOS() {
  const ua = navigator.userAgent
  // iPadOS se apresenta como Mac, mas tem tela de toque.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function ehSafariIOS() {
  return ehIOS() && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}
