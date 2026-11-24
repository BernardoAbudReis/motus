import { abrirApp, expect, test } from './apoio'

test('service worker: abre sem internet e guarda o que é feito offline', async ({ page, context, erros: _ }) => {
  await abrirApp(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // a partir daqui a página é controlada pelo service worker
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hoje' })).toBeVisible()
  await page.getByRole('button', { name: /Adicionar exemplos/ }).click()
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  await expect(page.locator('.cartao-habito.feito', { hasText: 'Fazer a cama' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.cartao-habito.feito', { hasText: 'Fazer a cama' })).toBeVisible()
  await context.setOffline(false)
})

test('manifest instalável', async ({ page, erros: _ }) => {
  await page.goto('/')
  const m = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href)).json())
  expect(m).toMatchObject({ name: 'MOTUS', display: 'standalone', start_url: '/' })
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
})

test('lembretes: ativar, testar e desativar neste aparelho', async ({ page, erros }) => {
  // O Chromium de teste não tem serviço de push e sempre nega notificações:
  // simula só a permissão e a inscrição do navegador; o resto é o app real.
  await page.addInitScript(() => {
    let permissao: NotificationPermission = 'default'
    Object.defineProperty(Notification, 'permission', { get: () => permissao })
    Notification.requestPermission = async () => (permissao = 'granted')
    let inscricao: unknown = null
    const base64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    PushManager.prototype.getSubscription = async () => inscricao as PushSubscription
    PushManager.prototype.subscribe = async () => {
      // Chaves do "aparelho" geradas na hora (como o navegador faria), nada fixo no repositório.
      const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
      const p256dh = base64url(await crypto.subtle.exportKey('raw', par.publicKey))
      const auth = base64url(crypto.getRandomValues(new Uint8Array(16)).buffer)
      const endpoint = `https://push.exemplo.invalid/${Date.now()}`
      inscricao = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh, auth } }), unsubscribe: async () => ((inscricao = null), true) }
      return inscricao as PushSubscription
    }
  })
  await abrirApp(page, '/#configuracoes')
  const cartao = page.locator('.cartao', { hasText: 'Notificações e lembretes' })

  await page.getByRole('button', { name: 'Ativar lembretes neste aparelho' }).click()
  await expect(cartao.getByText('Lembretes ativados neste aparelho.')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar teste' }).click()
  await expect(cartao.getByText(/Não foi possível entregar/)).toBeVisible() // endereço de push inexistente
  await page.getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByRole('button', { name: 'Ativar lembretes neste aparelho' })).toBeVisible()
  erros.length = 0 // o 500/erro de entrega simulado é esperado
})
