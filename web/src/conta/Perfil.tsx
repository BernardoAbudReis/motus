import { useState } from 'react'
import { reduzirImagem } from '../academia/dados'
import { Icone } from '../components/Icone'
import { alterarPreferencias, usePreferencias } from '../preferencias'

/** Nome e foto do perfil (sincronizados entre aparelhos). A foto é reduzida para 256 px. */
export function Perfil() {
  const prefs = usePreferencias()
  const [erro, setErro] = useState('')
  const inicial = (prefs.nome.trim()[0] ?? '?').toUpperCase()

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    setErro('')
    try {
      await alterarPreferencias({ foto: await reduzirImagem(arquivo, 256) })
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <>
      <div className="perfil">
        {prefs.foto ? (
          <img className="avatar" src={prefs.foto} alt="Foto do perfil" />
        ) : (
          <span className="avatar vazio" aria-hidden>
            {inicial}
          </span>
        )}
        <div className="perfil-acoes">
          <label className="botao">
            <Icone nome="camera" tamanho={18} /> {prefs.foto ? 'Trocar foto' : 'Escolher foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => void escolherFoto(e.target.files?.[0])} />
          </label>
          {prefs.foto && (
            <button className="botao" onClick={() => void alterarPreferencias({ foto: null })}>
              Remover
            </button>
          )}
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <label>
        Nome
        <input value={prefs.nome} placeholder="Como quer ser chamado" maxLength={100} onChange={(e) => void alterarPreferencias({ nome: e.target.value })} />
      </label>
    </>
  )
}
