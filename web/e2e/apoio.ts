import { test as base, expect, type Page } from '@playwright/test'

/** Página já sem o banner de instalação, com coleta de erros do console. */
export const test = base.extend<{ erros: string[] }>({
  erros: async ({ page }, usar) => {
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Service Worker registration blocked|status of 4\d\d/.test(m.text())) erros.push(m.text())
    })
    await page.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
    await usar(erros)
    expect(erros, 'erros no console').toEqual([])
  },
})

export { expect }

export function emailDeTeste(prefixo: string) {
  return `${prefixo}${Date.now()}${Math.random().toString(36).slice(2, 6)}@e2e.teste.local`
}

export async function adicionarExemplos(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Adicionar exemplos/ }).click()
  await expect(page.getByText('Fazer a cama')).toBeVisible()
}

/** Cria uma conta pela tela de Configurações. Devolve o e-mail e o código de recuperação mostrado. */
export async function criarConta(page: Page, senha = 'senha-de-teste-123') {
  const email = emailDeTeste('conta')
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('button', { name: 'Criar uma conta' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  const codigo = (await page.locator('.codigo-recuperacao').textContent())!.trim()
  await page.getByRole('button', { name: 'Já guardei' }).click()
  await expect(page.getByText(/Sincronizado às/)).toBeVisible({ timeout: 15_000 })
  return { email, senha, codigo }
}

/** Lê registros direto do IndexedDB do app. */
export function lerColecao(page: Page, colecao: string) {
  return page.evaluate(
    (c) =>
      new Promise<Record<string, unknown>[]>((ok) => {
        const r = indexedDB.open('habitos-academia')
        r.onsuccess = () => {
          const g = r.result.transaction(c).objectStore(c).getAll()
          g.onsuccess = () => ok(g.result)
        }
      }),
    colecao,
  )
}

/** Dia N dias atrás no formato AAAA-MM-DD (fuso local do navegador). */
export function diaPassado(page: Page, n: number) {
  return page.evaluate((n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, n)
}
