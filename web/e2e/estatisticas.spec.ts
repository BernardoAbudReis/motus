import { expect, test } from './apoio'

test.use({ serviceWorkers: 'block' })

test('estatísticas de hábitos e academia com histórico', async ({ page, erros: _ }) => {
  await page.goto('/')
  await expect(page.getByText('Comece pelo primeiro hábito')).toBeVisible()
  // 30 dias de histórico: cama todos os dias (sequência), 3 treinos.
  await page.evaluate(async () => {
    const dia = (n: number) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - n)
      return d
    }
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const base = { updatedAt: Date.now(), deletedAt: null, dirty: 0 }
    const habito = { ...base, id: 'h-cama', nome: 'Fazer a cama', icone: '🛏️', cor: 'grafite', frequencia: { tipo: 'diaria' }, meta: { tipo: 'check' }, ordem: 1, arquivado: false, criadoEm: dia(30).getTime() }
    const registros = Array.from({ length: 29 }, (_, i) => ({ ...base, id: `h-cama_${iso(dia(i + 1))}`, habitoId: 'h-cama', data: iso(dia(i + 1)), valor: 1, concluido: true }))
    const sessoes = [20, 13, 6].map((n, i) => {
      const inicio = dia(n)
      inicio.setHours(19)
      return {
        ...base,
        id: `s-${i}`,
        fichaId: 'f',
        fichaNome: 'Treino A',
        iniciadaEm: inicio.getTime(),
        finalizadaEm: inicio.getTime() + 3600_000,
        duracaoSeg: 3600,
        observacoes: '',
        exercicios: [{ exercicioId: 'base-supino-reto', nome: 'Supino reto', grupoMuscular: 'Peito', equipamento: 'Barra', repeticoesPlanejadas: 10, descansoSeg: 90, observacoes: '', series: [{ peso: 20 + i * 5, repeticoes: 10, concluida: true }] }],
      }
    })
    await new Promise<void>((ok) => {
      const r = indexedDB.open('habitos-academia')
      r.onsuccess = () => {
        const tx = r.result.transaction(['habitos', 'registrosHabito', 'sessoes'], 'readwrite')
        tx.objectStore('habitos').put(habito)
        registros.forEach((x) => tx.objectStore('registrosHabito').put(x))
        sessoes.forEach((s) => tx.objectStore('sessoes').put(s))
        tx.oncomplete = () => ok()
      }
    })
  })
  await page.reload() // o Dexie só percebe gravações feitas por fora depois de recarregar
  await page.goto('/#estatisticas')
  const kpisHabitos = page.locator('.secao-estat').first().locator('.kpis')
  await expect(kpisHabitos).toContainText('29 dias') // maior sequência atual
  await expect(kpisHabitos).toContainText('Fazer a cama')

  await page.getByRole('radio', { name: '7 dias' }).click()
  await expect(page.locator('.secao-estat').first().locator('.grafico-coluna')).toHaveCount(6) // hoje ainda sem registro
  await page.getByRole('radio', { name: '30 dias' }).click()

  const academia = page.locator('.secao-estat').nth(1)
  await expect(academia.locator('.kpis')).toContainText('3')
  await expect(academia.getByText('recorde 30 kg')).toBeVisible()
  await expect(academia.locator('.tabela tbody tr')).toHaveCount(3)
})
