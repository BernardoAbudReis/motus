import { abrirApp, expect, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('ficha, treino série a série, histórico com cópia da ficha e evolução', async ({ page, erros: _ }) => {
  await abrirApp(page, '/#academia')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  const dialogo = page.getByRole('dialog').last()
  await page.getByLabel('Nome', { exact: true }).fill('Treino A')
  await page.getByRole('button', { name: 'Adicionar exercício' }).click()
  await dialogo.getByLabel('Buscar exercício').fill('supino re')
  await dialogo.getByRole('button', { name: /Supino reto/ }).click()
  const item = page.locator('.item-ficha').first()
  await item.getByLabel('Séries').fill('3')
  await item.getByLabel('Peso inicial').fill('20')
  await page.getByRole('dialog').getByRole('button', { name: 'Criar ficha' }).click()

  // Treino 1.
  await page.getByRole('button', { name: 'Iniciar' }).click()
  await page.getByLabel('Peso da série 3').fill('22,5')
  for (const i of [1, 2, 3]) {
    await page.getByRole('button', { name: `Concluir série ${i}` }).click()
    await page.getByRole('button', { name: 'Pular' }).click()
  }
  await page.locator('.execucao-topo').getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.locator('.execucao')).toHaveCount(0)

  // Renomear a ficha não muda o histórico.
  await page.locator('.cartao-ficha-corpo').click()
  await page.getByLabel('Nome', { exact: true }).fill('Treino A2')
  await page.getByRole('button', { name: 'Salvar ficha' }).click()
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page.locator('.cartao-sessao-textos strong').first()).toHaveText('Treino A')

  // Treino 2 vem com os pesos da última vez.
  await page.getByRole('tab', { name: 'Treinar' }).click()
  await page.getByRole('button', { name: 'Iniciar' }).click()
  await expect(page.getByLabel('Peso da série 3')).toHaveValue('22,5')
  await page.getByLabel('Peso da série 3').fill('25')
  for (const i of [1, 2, 3]) await page.getByRole('button', { name: `Concluir série ${i}` }).click()
  await page.getByRole('button', { name: 'Pular' }).click()
  await page.locator('.execucao-topo').getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('button', { name: 'Salvar treino' }).click()

  await page.getByRole('tab', { name: 'Histórico' }).click()
  await page.locator('.cartao-sessao').first().click()
  await page.getByRole('dialog').getByRole('button', { name: /Supino reto/ }).click()
  await expect(page.locator('.grafico')).toBeVisible()
  await expect(page.getByRole('dialog').last().locator('.grade-estatisticas')).toContainText('25 kg')
})
