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

export interface Credenciais {
  email: string
  senha: string
  codigo: string
}

/** Cria a conta na tela inicial e confirma o código de recuperação. */
export async function cadastrar(page: Page, senha = 'senha-de-teste-123'): Promise<Credenciais> {
  const email = emailDeTeste('conta')
  if (await page.getByRole('button', { name: 'Criar uma conta' }).isVisible()) await page.getByRole('button', { name: 'Criar uma conta' }).click()
  await page.getByLabel('Como quer ser chamado (opcional)').fill('Teste')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel(/^Senha/).fill(senha)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  const codigo = (await page.locator('.codigo-recuperacao').textContent())!.trim()
  await page.getByRole('button', { name: 'Já guardei' }).click()
  await expect(page.locator('.nav-inferior')).toBeVisible()
  return { email, senha, codigo }
}

/**
 * Abre o app no endereço dado. Se aparecer a tela inicial (sem conta),
 * cria uma conta nova e devolve as credenciais; se já estiver dentro, devolve null.
 */
export async function abrirApp(page: Page, destino = '/'): Promise<Credenciais | null> {
  await page.goto(destino)
  const tela = page.locator('.tela-inicial')
  await tela.or(page.locator('.nav-inferior')).first().waitFor()
  return (await tela.isVisible()) ? cadastrar(page) : null
}

/** Entra com uma conta existente pela tela inicial (outro aparelho). */
export async function entrarNaTelaInicial(page: Page, email: string, senha: string) {
  await page.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
  await page.goto('/')
  await page.locator('.tela-inicial').waitFor()
  if (await page.getByRole('button', { name: 'Já tenho conta' }).isVisible()) await page.getByRole('button', { name: 'Já tenho conta' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.locator('.nav-inferior')).toBeVisible()
}

export async function adicionarExemplos(page: Page) {
  const credenciais = await abrirApp(page)
  await page.getByRole('button', { name: /Adicionar exemplos/ }).click()
  await expect(page.getByText('Fazer a cama')).toBeVisible()
  return credenciais
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
