import { readFileSync } from 'node:fs'
import { describe, expect, test, vi } from 'vitest'

/** Carrega public/sw-push.js num "service worker" falso e devolve os tratadores registrados. */
function carregarServiceWorker() {
  const tratadores: Record<string, (e: unknown) => void> = {}
  const janela = { focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) }
  const self = {
    location: { origin: 'https://motus.exemplo' },
    addEventListener: (tipo: string, f: (e: unknown) => void) => (tratadores[tipo] = f),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => [] as unknown[]), openWindow: vi.fn(async () => {}) },
  }
  const codigo = readFileSync(new URL('../public/sw-push.js', import.meta.url), 'utf8')
  new Function('self', codigo)(self)
  return { tratadores, self, janela }
}

function evento(extra: object) {
  const promessas: Promise<unknown>[] = []
  return { promessas, waitUntil: (p: Promise<unknown>) => promessas.push(p), ...extra }
}

describe('service worker dos lembretes', () => {
  test('mostra a notificação com título, texto e o endereço a abrir', async () => {
    const { tratadores, self } = carregarServiceWorker()
    const e = evento({ data: { json: () => ({ titulo: '📖 Ler', corpo: 'Por volta das 21:10.', tag: 'habito-1', url: '/#habitos' }) } })
    tratadores.push(e)
    await Promise.all(e.promessas)
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      '📖 Ler',
      expect.objectContaining({ body: 'Por volta das 21:10.', tag: 'habito-1', data: { url: '/#habitos' } }),
    )
  })

  test('tocar na notificação abre o app quando não há janela aberta', async () => {
    const { tratadores, self } = carregarServiceWorker()
    const e = evento({ notification: { close: vi.fn(), data: { url: '/#habitos' } } })
    tratadores.notificationclick(e)
    await Promise.all(e.promessas)
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://motus.exemplo/#habitos')
  })

  test('com o app aberto, traz a janela para frente em vez de abrir outra', async () => {
    const { tratadores, self, janela } = carregarServiceWorker()
    self.clients.matchAll.mockResolvedValue([janela])
    const e = evento({ notification: { close: vi.fn(), data: { url: '/#habitos' } } })
    tratadores.notificationclick(e)
    await Promise.all(e.promessas)
    expect(janela.focus).toHaveBeenCalled()
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })
})
