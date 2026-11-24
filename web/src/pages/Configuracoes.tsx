import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { entrar, sair, type Usuario } from '../api'
import { descreverSync, useEstadoSync } from '../components/IndicadorSync'
import { PassosInstalacao } from '../components/OrientacaoInstalacao'
import { db } from '../db'
import { alterarPreferencias, usePreferencias } from '../preferencias'
import { sincronizar } from '../sync'

function Conta() {
  const usuario = useLiveQuery(
    async () => ((await db.meta.get('usuario'))?.valor as Usuario | null) ?? null,
    [],
  )
  const estado = useEstadoSync()
  const [criarConta, setCriarConta] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email.trim(), senha, criarConta)
      setSenha('')
      void sincronizar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (usuario) {
    return (
      <>
        <p>
          Conectado como <strong>{usuario.email}</strong>
        </p>
        <p className="sutil">{descreverSync(estado)}</p>
        <div className="linha-botoes">
          <button className="botao" onClick={() => void sincronizar()}>
            🔄 Sincronizar agora
          </button>
          <button className="botao" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </>
    )
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <p className="sutil">
        Sem conta, os dados ficam só neste aparelho. Entre para ter backup e usar em outros aparelhos.
      </p>
      <label>
        E-mail
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Senha
        <input
          type="password"
          autoComplete={criarConta ? 'new-password' : 'current-password'}
          required
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="botao primario largo" disabled={enviando}>
        {criarConta ? 'Criar conta' : 'Entrar'}
      </button>
      <button type="button" className="botao-link" onClick={() => setCriarConta(!criarConta)}>
        {criarConta ? 'Já tenho conta' : 'Criar uma conta'}
      </button>
    </form>
  )
}

export function Configuracoes() {
  const prefs = usePreferencias()

  return (
    <section>
      <h1>Configurações</h1>

      <div className="cartao">
        <h2>Perfil</h2>
        <label>
          Nome
          <input
            value={prefs.nome}
            placeholder="Como quer ser chamado"
            onChange={(e) => void alterarPreferencias({ nome: e.target.value })}
          />
        </label>
      </div>

      <div className="cartao">
        <h2>Aparência</h2>
        <div className="alternador" role="radiogroup" aria-label="Tema">
          {(['escuro', 'claro'] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={prefs.tema === t}
              className={prefs.tema === t ? 'ativo' : ''}
              onClick={() => void alterarPreferencias({ tema: t })}
            >
              {t === 'escuro' ? '🌙 Escuro' : '☀️ Claro'}
            </button>
          ))}
        </div>
      </div>

      <div className="cartao">
        <h2>Backup e sincronização</h2>
        <Conta />
      </div>

      <div className="cartao">
        <h2>Instalar no celular</h2>
        <PassosInstalacao />
      </div>

      <p className="sutil centro">Versão {__VERSAO_APP__}</p>
    </section>
  )
}
