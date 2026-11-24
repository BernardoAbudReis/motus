import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { entrar, excluirConta, gerarCodigoRecuperacao, redefinirSenha, sair, trocarSenha, type Usuario } from '../api'
import { Folha } from '../components/Folha'
import { Icone } from '../components/Icone'
import { descreverSync, useEstadoSync } from '../components/IndicadorSync'
import { db } from '../db'
import { sincronizar } from '../sync'

/** Mostra o código de recuperação uma única vez, com botão de copiar. */
function CodigoRecuperacao({ codigo, onFechar }: { codigo: string; onFechar: () => void }) {
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
        <button
          className="botao"
          onClick={() => void navigator.clipboard?.writeText(codigo).then(() => setCopiado(true))}
        >
          <Icone nome={copiado ? 'check' : 'copiar'} tamanho={18} /> {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <button className="botao primario largo" onClick={onFechar}>
        Já guardei
      </button>
    </Folha>
  )
}

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

type Modo = 'entrar' | 'criar' | 'recuperar'
type Painel = 'codigo' | 'trocar' | 'excluir' | null

export function Conta() {
  const usuario = useLiveQuery(async () => ((await db.meta.get('usuario'))?.valor as Usuario | null) ?? null, [])
  const estado = useEstadoSync()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigoNovo, setCodigoNovo] = useState<string | null>(null)
  const [painel, setPainel] = useState<Painel>(null)
  const [senhaPainel, setSenhaPainel] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [aviso, setAviso] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      if (modo === 'recuperar') {
        setCodigoNovo(await redefinirSenha(email.trim(), codigo, senha))
      } else {
        const r = await entrar(email.trim(), senha, modo === 'criar')
        if (r.codigoRecuperacao) setCodigoNovo(r.codigoRecuperacao)
      }
      setSenha('')
      setCodigo('')
      // Ao sair ou excluir a conta, o formulário volta no modo "entrar" (com "Esqueci minha senha").
      setModo('entrar')
      void sincronizar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  function fecharPainel() {
    setPainel(null)
    setSenhaPainel('')
    setSenhaNova('')
  }

  const folhaCodigo = codigoNovo && <CodigoRecuperacao codigo={codigoNovo} onFechar={() => setCodigoNovo(null)} />

  if (usuario) {
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
              setAviso('')
            }}
          >
            <p>
              Apaga sua conta e <strong>todos os seus dados do servidor</strong>, sem volta. Os dados deste aparelho continuam aqui (dá para
              exportar antes ou apagar em "Dados").
            </p>
            <CampoSenha rotulo="Confirme com sua senha" valor={senhaPainel} onMudar={setSenhaPainel} />
          </FormularioPainel>
        )}
        {folhaCodigo}
      </>
    )
  }

  return (
    <>
      <form onSubmit={enviar} className="formulario">
        <p className="sutil">
          {modo === 'recuperar'
            ? 'Use o código de recuperação que apareceu quando você criou a conta.'
            : 'Sem conta, os dados ficam só neste aparelho. Entre para ter backup, lembretes e usar em outros aparelhos.'}
        </p>
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {modo === 'recuperar' && (
          <label>
            Código de recuperação
            <input required autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </label>
        )}
        <label>
          {modo === 'recuperar' ? 'Nova senha' : 'Senha'}
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="botao primario largo" disabled={enviando}>
          {modo === 'criar' ? 'Criar conta' : modo === 'recuperar' ? 'Redefinir senha' : 'Entrar'}
        </button>
        <div className="links-conta">
          {modo !== 'criar' && (
            <button type="button" className="botao-link" onClick={() => (setModo('criar'), setErro(''))}>
              Criar uma conta
            </button>
          )}
          {modo !== 'entrar' && (
            <button type="button" className="botao-link" onClick={() => (setModo('entrar'), setErro(''))}>
              Já tenho conta
            </button>
          )}
          {modo === 'entrar' && (
            <button type="button" className="botao-link" onClick={() => (setModo('recuperar'), setErro(''))}>
              Esqueci minha senha
            </button>
          )}
        </div>
      </form>
      {folhaCodigo}
    </>
  )
}
