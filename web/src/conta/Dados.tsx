import { useState } from 'react'
import { apagarDadosDoAparelho, exportarDados, importarDados } from '../arquivoDados'
import { Icone } from '../components/Icone'

/** Gerenciamento de dados: exportar, importar e apagar os dados deste aparelho. */
export function Dados() {
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return
    setMensagem(null)
    try {
      const { importados, ignorados } = await importarDados(arquivo)
      setMensagem({
        tipo: 'ok',
        texto: `${importados} ${importados === 1 ? 'registro importado' : 'registros importados'}${ignorados ? ` (${ignorados} já estavam iguais ou mais novos aqui)` : ''}.`,
      })
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message })
    }
  }

  return (
    <>
      <p className="sutil">Um arquivo com todos os seus hábitos, treinos e configurações. Funciona sem conta e sem internet.</p>
      <div className="linha-botoes">
        <button
          className="botao"
          onClick={() =>
            void exportarDados().then((n) => setMensagem({ tipo: 'ok', texto: `Arquivo gerado com ${n} ${n === 1 ? 'registro' : 'registros'}.` }))
          }
        >
          <Icone nome="instalar" tamanho={18} /> Exportar dados
        </button>
        <label className="botao">
          <Icone nome="enviar" tamanho={18} /> Importar arquivo
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void importar(e.target.files?.[0])} />
        </label>
      </div>
      {mensagem && <p className={mensagem.tipo === 'erro' ? 'erro' : 'sutil'}>{mensagem.texto}</p>}
      <button
        className="botao-link perigo"
        onClick={() => {
          if (!confirm('Apagar todos os dados deste aparelho? A conta e o que já foi sincronizado continuam no servidor.')) return
          if (!confirm('Tem certeza? O que não foi sincronizado nem exportado será perdido.')) return
          void apagarDadosDoAparelho()
        }}
      >
        Apagar dados deste aparelho
      </button>
    </>
  )
}
