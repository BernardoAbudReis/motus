import { useState, type FormEvent } from 'react'
import { entrar, redefinirSenha } from '../api'
import { descreverSync, useEstadoSync } from '../components/IndicadorSync'
import { alterarPreferencias } from '../preferencias'
import { sincronizar } from '../sync'
import { CodigoRecuperacao } from './CodigoRecuperacao'
import { CHAVE_JA_ENTROU, segurarPortao } from './portao'

type Modo = 'criar' | 'entrar' | 'recuperar'

function mensagemDeErro(err: unknown) {
  if (!navigator.onLine || err instanceof TypeError) return 'Sem conexão com a internet. Conecte-se para criar a conta ou entrar.'
  return (err as Error).message
}

/**
 * Tela de entrada do app: criar conta ou entrar antes de usar. Os dados que
 * já estiverem neste aparelho sobem para a conta na primeira sincronização.
 */
export function TelaInicial() {
  const [modo, setModo] = useState<Modo>(() => (localStorage.getItem(CHAVE_JA_ENTROU) ? 'entrar' : 'criar'))
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigoNovo, setCodigoNovo] = useState<string | null>(null)
  const estadoSync = useEstadoSync()

  function trocarModo(m: Modo) {
    setModo(m)
    setErro('')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    // Criar conta e redefinir senha devolvem um código: o app só abre depois de ele ser guardado.
    if (modo !== 'entrar') segurarPortao(true)
    try {
      if (modo === 'recuperar') {
        setCodigoNovo(await redefinirSenha(email.trim(), codigo, senha))
      } else {
        const r = await entrar(email.trim(), senha, modo === 'criar', nome.trim() || undefined)
        if (modo === 'criar' && nome.trim()) await alterarPreferencias({ nome: nome.trim() })
        if (r.codigoRecuperacao) setCodigoNovo(r.codigoRecuperacao)
      }
      void sincronizar()
    } catch (err) {
      segurarPortao(false)
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela-inicial">
      <div className="tela-inicial-conteudo">
        <img className="tela-inicial-logo" src="/logo.svg" alt="" width={88} height={88} />
        <h1>MOTUS</h1>
        <p className="tela-inicial-slogan">Hábitos e treinos em um só lugar. Disciplina, movimento e evolução.</p>

        <form className="formulario cartao" onSubmit={enviar}>
          <h2>{modo === 'criar' ? 'Criar sua conta' : modo === 'entrar' ? 'Entrar' : 'Redefinir senha'}</h2>
          <p className="sutil">
            {modo === 'recuperar'
              ? 'Use o código de recuperação que apareceu quando você criou a conta.'
              : 'Sua conta guarda o backup, envia os lembretes e deixa você usar em outros aparelhos.'}
          </p>
          {estadoSync.tipo === 'erro' && modo === 'entrar' && <p className="erro">{descreverSync(estadoSync)}</p>}
          {modo === 'criar' && (
            <label>
              Como quer ser chamado (opcional)
              <input autoComplete="given-name" maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
          )}
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
            {modo === 'recuperar' ? 'Nova senha' : modo === 'criar' ? 'Senha (mínimo 8 caracteres)' : 'Senha'}
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
              <button type="button" className="botao-link" onClick={() => trocarModo('criar')}>
                Criar uma conta
              </button>
            )}
            {modo !== 'entrar' && (
              <button type="button" className="botao-link" onClick={() => trocarModo('entrar')}>
                Já tenho conta
              </button>
            )}
            {modo === 'entrar' && (
              <button type="button" className="botao-link" onClick={() => trocarModo('recuperar')}>
                Esqueci minha senha
              </button>
            )}
          </div>
        </form>
      </div>
      {codigoNovo && (
        <CodigoRecuperacao
          codigo={codigoNovo}
          onFechar={() => {
            setCodigoNovo(null)
            segurarPortao(false)
          }}
        />
      )}
    </div>
  )
}
