import { adicionarExemplos, expect, lerColecao, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('marcar, somar e persistir; toques rápidos não se perdem', async ({ page, erros: _ }) => {
  await adicionarExemplos(page)
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  await expect(page.locator('.cartao-habito', { hasText: 'Fazer a cama' }).locator('.contador')).toContainText('1')
  await expect(page.locator('canvas.canvas-confetes')).toHaveCount(1) // confetes ao concluir

  // Novo hábito de quantidade pela edição em lista.
  await page.getByRole('button', { name: 'Novo hábito' }).click()
  await page.getByLabel('Nome').fill('Beber água')
  await page.getByRole('button', { name: /^Meta/ }).click()
  await page.getByRole('button', { name: 'Quantidade' }).click()
  await page.getByLabel('Unidade').fill('copos')
  await page.getByRole('button', { name: 'Salvar hábito' }).click()
  const somar = page.getByRole('button', { name: 'Somar 1 em Beber água' })
  await somar.click()
  await somar.click()
  const agua = page.locator('.cartao-habito', { hasText: 'Beber água' }).locator('.habito-sub')
  await expect(agua).toHaveText('Todo dia, 2/8 copos')
  await page.reload()
  await expect(agua).toHaveText('Todo dia, 2/8 copos')
})

test('hora da conclusão só é gravada para hoje; dia passado não entra na média', async ({ page, erros: _ }) => {
  await adicionarExemplos(page)
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  const dias = page.locator('.calendario-horizontal .dia:not(.futuro)')
  await dias.nth((await dias.count()) - 2).click()
  await page.getByRole('button', { name: 'Marcar Fazer a cama como feito' }).click()
  await expect
    .poll(async () => (await lerColecao(page, 'registrosHabito')).map((r) => typeof r.concluidoEm).sort())
    .toEqual(['number', 'object']) // hoje: número; ontem: null
})

test('começa em antigo mostra os dias sem fazer (−N)', async ({ page, erros: _ }) => {
  await adicionarExemplos(page)
  await page.getByRole('button', { name: 'Abrir Tomar creatina' }).click()
  await page.getByRole('button', { name: 'Editar' }).click()
  const d = await page.evaluate(() => {
    const x = new Date()
    x.setDate(x.getDate() - 10)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
  await page.locator('input[type=date]').fill(d)
  await page.getByRole('button', { name: 'Salvar hábito' }).click()
  await expect(page.locator('.cartao-habito', { hasText: 'Tomar creatina' }).locator('.contador.sem-fazer')).toHaveText('−10')
})

test('arquivar tira da lista do dia', async ({ page, erros: _ }) => {
  await adicionarExemplos(page)
  await page.getByRole('button', { name: 'Abrir Fazer a cama' }).click()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Fazer a cama' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver arquivados' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Fazer a cama' })).toBeVisible()
})
