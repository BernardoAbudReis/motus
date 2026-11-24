import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { excluirConta, gerarCodigoRecuperacao, sair, trocarSenha, type Usuario } from '../api'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import { descreverSync, useEstadoSync } from '../components/IndicadorSync'
import { db } from '../db'
import { sincronizar } from '../sync'
import { CodigoRecuperacao } from './CodigoRecuperacao'

/** Formulário simples dentro de um painel (trocar senha, excluir conta...). */
function FormularioPainel({
  titulo,
  children,
  botao,
  perigo = false,
  onEnviar,
  onFechar,
}: {
  titulo: string
  children: ReactNode
  botao: string
  perigo?: boolean
  onEnviar: () => Promise<void>
  onFechar: () => void
}) {
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await onEnviar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Folha titulo={titulo} onFechar={onFechar}>
      <form className="formulario" onSubmit={enviar}>
        {children}
        {erro && <p className="erro">{erro}</p>}
        <button className={`botao largo ${perigo ? 'perigo-cheio' : 'primario'}`} disabled={enviando}>
          {botao}
        </button>
      </form>
    </Folha>
  )
}

function CampoSenha({ rotulo, valor, onMudar, nova = false }: { rotulo: string; valor: string; onMudar: (v: string) => void; nova?: boolean }) {
  return (
    <label>
      {rotulo}
      <input type="password" required minLength={8} autoComplete={nova ? 'new-password' : 'current-password'} value={valor} onChange={(e) => onMudar(e.target.value)} />
    </label>
  )
}

type Painel = 'codigo' | 'trocar' | 'excluir' | null

/**
 * Conta conectada, em Configurações. Sem conta, o app mostra a tela inicial
 * (conta/TelaInicial.tsx) no lugar de tudo, então esta seção não aparece.
 */
export function Conta() {
  const usuario = useLiveQuery(async () => ((await db.meta.get('usuario'))?.valor as Usuario | null) ?? null, [])
  const estado = useEstadoSync()
  const [codigoNovo, setCodigoNovo] = useState<string | null>(null)
  const [painel, setPainel] = useState<Painel>(null)
  const [senhaPainel, setSenhaPainel] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [aviso, setAviso] = useState('')

  function fecharPainel() {
    setPainel(null)
    setSenhaPainel('')
    setSenhaNova('')
  }

  if (!usuario) return null

  return (
    <>
      <p>
        Conectado como <strong>{usuario.email}</strong>
      </p>
      <p className="sutil">{descreverSync(estado)}</p>
      <div className="linha-botoes">
        <button className="botao" onClick={() => void sincronizar()}>
          <Icone nome="sincronizar" tamanho={18} /> Sincronizar agora
        </button>
        <button className="botao" onClick={() => void sair()}>
          <Icone nome="sair" tamanho={18} /> Sair
        </button>
      </div>
      {aviso && <p className="sutil">{aviso}</p>}
      <div className="lista-agrupada acoes-conta">
        <button className="linha-ajuste" onClick={() => setPainel('codigo')}>
          <span className="ajuste-icone">
            <Icone nome="chave" tamanho={18} />
          </span>
          <span className="ajuste-rotulo">Novo código de recuperação</span>
        </button>
        <button className="linha-ajuste" onClick={() => setPainel('trocar')}>
          <span className="ajuste-icone">
            <Icone nome="cadeado" tamanho={18} />
          </span>
          <span className="ajuste-rotulo">Trocar senha</span>
        </button>
        <button className="linha-ajuste perigo" onClick={() => setPainel('excluir')}>
          <span className="ajuste-icone">
            <Icone nome="lixeira" tamanho={18} />
          </span>
          <span className="ajuste-rotulo">Excluir conta</span>
        </button>
      </div>

      {painel === 'codigo' && (
        <FormularioPainel
          titulo="Novo código de recuperação"
          botao="Gerar código"
          onFechar={fecharPainel}
          onEnviar={async () => {
            const novo = await gerarCodigoRecuperacao(senhaPainel)
            fecharPainel()
            setCodigoNovo(novo)
          }}
        >
          <p className="sutil">O código anterior deixa de valer.</p>
          <CampoSenha rotulo="Sua senha" valor={senhaPainel} onMudar={setSenhaPainel} />
        </FormularioPainel>
      )}
      {painel === 'trocar' && (
        <FormularioPainel
          titulo="Trocar senha"
          botao="Trocar senha"
          onFechar={fecharPainel}
          onEnviar={async () => {
            await trocarSenha(senhaPainel, senhaNova)
            fecharPainel()
            setAviso('Senha trocada. Os outros aparelhos vão pedir para entrar de novo.')
          }}
        >
          <CampoSenha rotulo="Senha atual" valor={senhaPainel} onMudar={setSenhaPainel} />
          <CampoSenha rotulo="Nova senha (mínimo 8 caracteres)" valor={senhaNova} onMudar={setSenhaNova} nova />
        </FormularioPainel>
      )}
      {painel === 'excluir' && (
        <FormularioPainel
          titulo="Excluir conta"
          botao="Excluir minha conta"
          perigo
          onFechar={fecharPainel}
          onEnviar={async () => {
            await excluirConta(senhaPainel)
            fecharPainel()
          }}
        >
          <p>
            Apaga sua conta e <strong>todos os seus dados do servidor</strong>, sem volta. Os dados deste aparelho continuam aqui (dá para exportar
            antes ou apagar em "Dados").
          </p>
          <CampoSenha rotulo="Confirme com sua senha" valor={senhaPainel} onMudar={setSenhaPainel} />
        </FormularioPainel>
      )}
      {codigoNovo && <CodigoRecuperacao codigo={codigoNovo} onFechar={() => setCodigoNovo(null)} />}
    </>
  )
}
