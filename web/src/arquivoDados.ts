import { COLECOES, db, tabela, type Colecao, type Sincronizavel } from './db'
import { dataLocal } from './repo'
import { agendarSincronizacao } from './sync'

/**
 * Exportar e importar todos os dados em um arquivo JSON. Funciona sem conta e
 * sem internet: é o backup que o usuário guarda onde quiser.
 */

interface ArquivoMotus {
  app: 'MOTUS'
  versao: 1
  exportadoEm: string
  colecoes: Partial<Record<Colecao, Sincronizavel[]>>
}

export async function exportarDados() {
  const colecoes: ArquivoMotus['colecoes'] = {}
  let total = 0
  for (const c of COLECOES) {
    // Inclui exclusões (deletedAt): ao importar em outro aparelho, a exclusão também vale.
    const registros = (await tabela(c).toArray()).map(({ dirty: _dirty, ...r }) => r as Sincronizavel)
    colecoes[c] = registros
    total += registros.filter((r) => r.deletedAt === null).length
  }
  const arquivo: ArquivoMotus = { app: 'MOTUS', versao: 1, exportadoEm: new Date().toISOString(), colecoes }
  const blob = new Blob([JSON.stringify(arquivo)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `motus-dados-${dataLocal()}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return total
}

/**
 * Junta os dados do arquivo com os do aparelho: cada registro só entra se não
 * existir aqui ou se for mais novo (mesma regra da sincronização). Nada é
 * apagado do aparelho por importar.
 */
export async function importarDados(arquivo: File) {
  let conteudo: ArquivoMotus
  try {
    conteudo = JSON.parse(await arquivo.text())
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  if (conteudo?.app !== 'MOTUS' || conteudo.versao !== 1 || typeof conteudo.colecoes !== 'object') {
    throw new Error('Este arquivo não é uma exportação do MOTUS.')
  }

  let importados = 0
  let ignorados = 0
  await db.transaction('rw', COLECOES.map(tabela), async () => {
    for (const c of COLECOES) {
      for (const r of conteudo.colecoes[c] ?? []) {
        if (typeof r?.id !== 'string' || typeof r.updatedAt !== 'number') {
          ignorados++
          continue
        }
        const local = await tabela(c).get(r.id)
        if (local && local.updatedAt >= r.updatedAt) {
          ignorados++
          continue
        }
        await tabela(c).put({ ...r, deletedAt: r.deletedAt ?? null, dirty: 1 })
        importados++
      }
    }
  })
  agendarSincronizacao(500)
  return { importados, ignorados }
}

/** Apaga tudo deste aparelho (não mexe na conta nem no servidor). */
export async function apagarDadosDoAparelho() {
  db.close()
  await db.delete()
  localStorage.clear()
  location.reload()
}
