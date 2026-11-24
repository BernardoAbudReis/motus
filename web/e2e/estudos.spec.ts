import { abrirApp, diaPassado, entrarNaTelaInicial, expect, lerColecao, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('estudos: matéria, conteúdos, planejar, concluir rápido, detalhes, reagendar, atrasar, revisar e remover', async ({ page, browser, erros: _ }) => {
  test.setTimeout(120_000) // percorre o fluxo inteiro e ainda sincroniza com outro aparelho
  page.on('dialog', (d) => void d.accept())
  const { email, senha } = (await abrirApp(page, '/#estudos'))!
  await expect(page.getByText('Organize seus estudos')).toBeVisible()

  // Matéria e conteúdos.
  await page.getByRole('button', { name: 'Criar primeira matéria' }).click()
  await page.getByLabel('Nome').fill('JavaScript')
  await page.getByLabel('Cor personalizada').fill('#3a5fcd') // cor criada no seletor do aparelho
  await expect(page.getByText('Cor personalizada #3A5FCD')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar matéria' }).click()
  await expect.poll(async () => (await lerColecao(page, 'materias'))[0]?.cor).toBe('#3A5FCD')
  const materia = page.getByRole('dialog', { name: 'JavaScript' })
  for (const nome of ['Arrays', 'Objetos', 'Promises']) {
    await materia.getByLabel('Novo conteúdo').fill(nome)
    await materia.getByLabel('Novo conteúdo').press('Enter')
  }
  await expect(materia.locator('.linha-conteudo')).toHaveCount(3)
  await expect(materia.locator('.progresso-materia-pct')).toHaveText('0%')
  await materia.getByRole('button', { name: 'Fechar' }).click()

  // Planejar dois estudos para hoje.
  await page.getByRole('button', { name: 'Planejar' }).first().click()
  const planejar = page.getByRole('dialog', { name: 'Planejar estudo' })
  for (const nome of ['Arrays', 'Objetos']) {
    await planejar.getByLabel('Conteúdo').selectOption({ label: nome })
    await planejar.getByRole('button', { name: 'Adicionar ao planejamento' }).click()
  }
  await planejar.getByRole('button', { name: 'Pronto' }).click()
  await expect(page.getByText('0 de 2 atividades feitas')).toBeVisible()

  // Concluir com um toque e completar os detalhes depois.
  await page.getByRole('button', { name: 'Marcar Arrays como feito' }).click()
  await expect(page.getByText('1 de 2 atividades feitas')).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar detalhes' }).click()
  const detalhes = page.getByRole('dialog', { name: 'Detalhes do estudo' })
  await detalhes.getByRole('button', { name: '45 min' }).click()
  await detalhes.getByRole('radio', { name: 'Média' }).click()
  await detalhes.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.locator('.secao-estudos', { hasText: 'Progresso geral' })).toContainText('45 min')

  // Reagendar para ontem: continua pendente, agora como atrasada (nada é concluído sozinho).
  const ontem = await diaPassado(page, 1)
  await page.getByRole('button', { name: 'Opções de Objetos' }).click()
  const opcoes = page.getByRole('dialog', { name: 'Objetos' })
  await opcoes.getByRole('button', { name: 'Reagendar' }).first().click()
  await opcoes.getByLabel('Nova data').fill(ontem)
  await opcoes.getByRole('button', { name: 'Reagendar' }).last().click()
  await expect(page.locator('.secao-estudos', { hasText: 'Atrasadas' }).getByText('Objetos')).toBeVisible()
  await expect(page.getByText(/atrasada desde/)).toBeVisible()
  const atividades = await lerColecao(page, 'atividades')
  const objetos = atividades.find((a) => (a.reagendamentos as unknown[]).length > 0)!
  expect(objetos.data).toBe(ontem)
  expect(objetos.dataOriginal).not.toBe(ontem) // a data original fica guardada
  expect(objetos.estado).toBe('planejada')

  // Registrar sem planejar e marcar o conteúdo como concluído.
  await page.getByRole('button', { name: 'Registrar estudo' }).click()
  const registro = page.getByRole('dialog', { name: 'Registrar estudo' })
  await registro.getByLabel('Conteúdo').selectOption({ label: 'Promises' })
  await registro.getByLabel(/Tempo estudado/).fill('20')
  await registro.getByRole('switch', { name: 'Conteúdo concluído' }).check()
  await registro.getByRole('button', { name: 'Salvar', exact: true }).click()

  // Agendar revisão pelo conteúdo e conferir em Revisões.
  await page.getByRole('tab', { name: 'Matérias' }).click()
  await expect(page.locator('.cartao-materia')).toContainText('33%') // 1 de 3 concluídos
  await page.locator('.cartao-materia').click()
  await page.getByRole('dialog', { name: 'JavaScript' }).getByRole('button', { name: /Arrays/ }).click()
  const conteudo = page.getByRole('dialog', { name: 'Arrays' })
  await expect(conteudo.getByRole('radio', { name: 'Em andamento' })).toHaveAttribute('aria-checked', 'true')
  await conteudo.getByRole('button', { name: 'Em 7 dias' }).click()
  await page.getByRole('dialog', { name: 'Agendar revisão' }).getByRole('button', { name: 'Adicionar ao planejamento' }).click()
  await page.getByRole('dialog', { name: 'Agendar revisão' }).getByRole('button', { name: 'Pronto' }).click()
  await expect(conteudo.locator('.resumo-item', { hasText: 'próxima revisão' })).not.toContainText('—')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Revisões' }).click()
  await expect(page.locator('.secao-estudos', { hasText: 'Próximas' }).getByText('Arrays')).toBeVisible()

  // Remover do planejamento: sai da lista de hoje, mas fica no histórico como removida.
  await page.getByRole('tab', { name: 'Hoje' }).click()
  await page.getByRole('button', { name: 'Opções de Objetos' }).click()
  await page.getByRole('dialog', { name: 'Objetos' }).getByRole('button', { name: 'Remover do planejamento' }).click()
  await expect(page.getByRole('heading', { name: 'Atrasadas', exact: true })).toHaveCount(0)
  expect((await lerColecao(page, 'atividades')).filter((a) => a.estado === 'removida' && a.deletedAt === null)).toHaveLength(1)

  // Semana passada continua acessível no histórico.
  await page.getByRole('tab', { name: 'Semana' }).click()
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(page.getByText('Semana passada')).toBeVisible()

  // Tudo sincroniza: outro aparelho recebe matérias e progresso.
  // A sincronização junta gravações seguidas (espera 1,5 s sem mudanças): aguarda o envio terminar.
  await expect
    .poll(async () => {
      const colecoes = ['setores', 'materias', 'conteudos', 'atividades', 'sessoesEstudo']
      const registros = (await Promise.all(colecoes.map((c) => lerColecao(page, c)))).flat()
      return registros.filter((r) => r.dirty === 1).length
    }, { timeout: 15_000 })
    .toBe(0)
  const outro = await (await browser.newContext()).newPage()
  await entrarNaTelaInicial(outro, email, senha)
  await outro.getByRole('button', { name: 'Estudos' }).click()
  await outro.getByRole('tab', { name: 'Matérias' }).click()
  await expect(outro.locator('.cartao-materia')).toContainText('33%', { timeout: 15_000 })
})
