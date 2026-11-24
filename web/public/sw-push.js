/* Lembretes do MOTUS: importado pelo service worker gerado pelo Workbox (vite.config.ts). */

self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'MOTUS', {
      body: dados.corpo || '',
      icon: '/pwa-192x192.png',
      tag: dados.tag,
      renotify: !!dados.tag,
      lang: 'pt-BR',
      data: { url: dados.url || '/#habitos' },
    }),
  )
})

// Tocar na notificação abre o app (ou traz para frente se já estiver aberto).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          if ('navigate' in janela) janela.navigate(url).catch(() => {})
          return janela.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
