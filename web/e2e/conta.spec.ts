import { adicionarExemplos, criarConta, expect, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('código de recuperação: esqueci a senha, redefino e entro em outro aparelho', async ({ page, browser, erros: _ }) => {
  await adicionarExemplos(page)
  const { email, codigo } = await criarConta(page)
  expect(codigo).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)
  await page.getByRole('button', { name: 'Sair' }).click()

  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Código de recuperação').fill(codigo)
  await page.getByLabel('Nova senha').fill('senha-redefinida-1')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()
  const novoCodigo = (await page.locator('.codigo-recuperacao').textContent())!.trim()
  expect(novoCodigo).not.toBe(codigo)
  await page.getByRole('button', { name: 'Já guardei' }).click()
  await expect(page.getByText(`Conectado como ${email}`)).toBeVisible()

  // Outro aparelho entra com a senha nova e recebe os hábitos.
  const outro = await (await browser.newContext()).newPage()
  await outro.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
  await outro.goto('/#configuracoes')
  await outro.getByLabel('E-mail').fill(email)
  await outro.getByLabel('Senha', { exact: true }).fill('senha-redefinida-1')
  await outro.getByRole('button', { name: 'Entrar' }).click()
  await expect(outro.getByText(/Sincronizado às/)).toBeVisible({ timeout: 15_000 })
  await outro.goto('/#habitos')
  await expect(outro.getByText('Fazer a cama')).toBeVisible()
})

test('trocar a senha desconecta o outro aparelho', async ({ page, browser, erros: _ }) => {
  await page.goto('/')
  const { email, senha } = await criarConta(page)
  const outro = await (await browser.newContext()).newPage()
  await outro.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
  await outro.goto('/#configuracoes')
  await outro.getByLabel('E-mail').fill(email)
  await outro.getByLabel('Senha', { exact: true }).fill(senha)
  await outro.getByRole('button', { name: 'Entrar' }).click()
  await expect(outro.getByText(/Sincronizado às/)).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await page.getByLabel('Senha atual').fill(senha)
  await page.getByLabel(/Nova senha/).fill('senha-trocada-123')
  await page.getByRole('button', { name: 'Trocar senha' }).last().click()
  await expect(page.getByText(/Os outros aparelhos vão pedir/)).toBeVisible()

  await outro.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(outro.getByText('Criar uma conta')).toBeVisible({ timeout: 15_000 }) // voltou para o login
})

test('exportar e importar dados em arquivo; excluir a conta', async ({ page, erros: _ }) => {
  await adicionarExemplos(page)
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados' }).click()])
  expect(download.suggestedFilename()).toMatch(/^motus-dados-\d{4}-\d{2}-\d{2}\.json$/)
  const caminho = await download.path()

  // Importa num aparelho vazio.
  const vazio = await (await page.context().browser()!.newContext()).newPage()
  await vazio.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
  await vazio.goto('/#configuracoes')
  await vazio.locator('input[type=file][accept*="json"]').setInputFiles(caminho)
  await expect(vazio.getByText(/registros importados/)).toBeVisible()
  await vazio.goto('/#habitos')
  await expect(vazio.getByText('Fazer a cama')).toBeVisible()

  // Excluir conta.
  const { senha } = await criarConta(page)
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Confirme com sua senha').fill(senha)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page.getByRole('button', { name: 'Criar uma conta' })).toBeVisible()
})
