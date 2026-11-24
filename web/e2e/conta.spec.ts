import { abrirApp, adicionarExemplos, entrarNaTelaInicial, expect, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('tela inicial: sem conta não entra no app; cria conta, guarda o código e entra', async ({ page, erros: _ }) => {
  await page.goto('/')
  await expect(page.locator('.tela-inicial')).toBeVisible()
  await expect(page.locator('.nav-inferior')).toHaveCount(0)
  // Abre sempre em "Entrar"; criar conta fica no link abaixo.
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar uma conta' }).click()
  await expect(page.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible()

  // O app só abre depois de confirmar que guardou o código.
  await page.getByLabel('Como quer ser chamado (opcional)').fill('Bernardo')
  await page.getByLabel('E-mail').fill(`portao${Date.now()}@e2e.teste.local`)
  await page.getByLabel(/^Senha/).fill('senha-de-teste-123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.locator('.codigo-recuperacao')).toHaveText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)
  await expect(page.locator('.nav-inferior')).toHaveCount(0)
  await page.getByRole('button', { name: 'Já guardei' }).click()
  await expect(page.locator('.nav-inferior')).toBeVisible()

  // O nome informado vira o nome do perfil.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByLabel('Nome')).toHaveValue('Bernardo')
})

test('código de recuperação: esqueci a senha, redefino e entro em outro aparelho', async ({ page, browser, erros: _ }) => {
  const { email, codigo } = (await adicionarExemplos(page))!
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()

  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Código de recuperação').fill(codigo)
  await page.getByLabel('Nova senha').fill('senha-redefinida-1')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()
  const novoCodigo = (await page.locator('.codigo-recuperacao').textContent())!.trim()
  expect(novoCodigo).not.toBe(codigo)
  await page.getByRole('button', { name: 'Já guardei' }).click()
  await page.getByRole('button', { name: 'Hábitos' }).click()
  await expect(page.getByText('Fazer a cama')).toBeVisible()

  // Outro aparelho entra com a senha nova e recebe os hábitos.
  const outro = await (await browser.newContext()).newPage()
  await entrarNaTelaInicial(outro, email, 'senha-redefinida-1')
  await expect(outro.getByText('Fazer a cama')).toBeVisible({ timeout: 15_000 })
})

test('trocar a senha desconecta o outro aparelho', async ({ page, browser, erros: _ }) => {
  const { email, senha } = (await abrirApp(page, '/#configuracoes'))!
  const outro = await (await browser.newContext()).newPage()
  await entrarNaTelaInicial(outro, email, senha)

  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await page.getByLabel('Senha atual').fill(senha)
  await page.getByLabel(/Nova senha/).fill('senha-trocada-123')
  await page.getByRole('button', { name: 'Trocar senha' }).last().click()
  await expect(page.getByText(/Os outros aparelhos vão pedir/)).toBeVisible()

  await outro.getByRole('button', { name: 'Configurações' }).click()
  await outro.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(outro.locator('.tela-inicial')).toBeVisible({ timeout: 15_000 }) // voltou para a tela inicial
  await expect(outro.getByText(/sessão terminou/)).toBeVisible()
})

test('exportar e importar dados em arquivo; excluir a conta', async ({ page, browser, erros: _ }) => {
  const { senha } = (await adicionarExemplos(page))!
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados' }).click()])
  expect(download.suggestedFilename()).toMatch(/^motus-dados-\d{4}-\d{2}-\d{2}\.json$/)
  const caminho = await download.path()

  // Importa num aparelho novo, com outra conta.
  const vazio = await (await browser.newContext()).newPage()
  await vazio.addInitScript(() => localStorage.setItem('instalacao-dispensada', '1'))
  await abrirApp(vazio, '/#configuracoes')
  await vazio.locator('input[type=file][accept*="json"]').setInputFiles(caminho)
  await expect(vazio.getByText(/registros importados/)).toBeVisible()
  await vazio.getByRole('button', { name: 'Hábitos' }).click()
  await expect(vazio.getByText('Fazer a cama')).toBeVisible()

  // Excluir a conta volta para a tela inicial.
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Confirme com sua senha').fill(senha)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page.locator('.tela-inicial')).toBeVisible()
})
