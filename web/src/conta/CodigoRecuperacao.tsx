import { useState } from 'react'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'

/** Mostra o código de recuperação uma única vez, com botão de copiar. */
export function CodigoRecuperacao({ codigo, onFechar }: { codigo: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Folha titulo="Código de recuperação" onFechar={onFechar}>
      <p>
        Guarde este código num lugar seguro (gerenciador de senhas, foto, papel). É com ele que você redefine a senha se esquecer. Ele
        <strong> não aparece de novo</strong>.
      </p>
      <p className="codigo-recuperacao" aria-label="Código de recuperação">
        {codigo}
      </p>
      <div className="linha-botoes">
        <button className="botao" onClick={() => void navigator.clipboard?.writeText(codigo).then(() => setCopiado(true))}>
          <Icone nome={copiado ? 'check' : 'copiar'} tamanho={18} /> {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <button className="botao primario largo" onClick={onFechar}>
        Já guardei
      </button>
    </Folha>
  )
}
