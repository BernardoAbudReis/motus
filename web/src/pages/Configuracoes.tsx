import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Icone } from '../components/Icone'
import { PassosInstalacao } from '../components/OrientacaoInstalacao'
import { db } from '../db'
import { Conta } from '../conta/Conta'
import { Dados } from '../conta/Dados'
import { Perfil } from '../conta/Perfil'
import { alterarPreferencias, usePreferencias } from '../preferencias'
import { ativarNotificacoes, desativarNotificacoes, enviarTeste, useEstadoNotificacoes } from '../notificacoes'

function Notificacoes() {
  const { estado, atualizar } = useEstadoNotificacoes()
  const logado = useLiveQuery(async () => !!(await db.meta.get('token'))?.valor, [])
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<string | void>) {
    setOcupado(true)
    setMensagem(null)
    try {
      const texto = await acao()
      if (texto) setMensagem({ tipo: 'ok', texto })
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(false)
      atualizar()
    }
  }

  if (estado === null) return null

  return (
    <>
      <p className="sutil">
        Cada hábito avisa no horário em que você costuma concluí-lo (a média dos últimos dias), só nos dias agendados e só se
        ainda não foi feito. Ajuste ou desligue por hábito, na edição do hábito.
      </p>
      {estado === 'instalar-iphone' && (
        <p className="linha-icone">
          <Icone nome="instalar" tamanho={18} /> No iPhone, instale o MOTUS na tela de início (iOS 16.4 ou mais novo) e ative por lá.
        </p>
      )}
      {estado === 'sem-suporte' && <p className="sutil">Este navegador não aceita notificações.</p>}
      {estado === 'negado' && <p className="erro">As notificações estão bloqueadas. Libere nas configurações do navegador para este site.</p>}
      {!logado && (estado === 'desligado' || estado === 'ligado') && (
        <p className="sutil">Entre na sua conta (acima) para receber lembretes: eles são enviados pelo servidor.</p>
      )}
      {estado === 'desligado' && logado && (
        <button className="botao primario largo" disabled={ocupado} onClick={() => void executar(ativarNotificacoes)}>
          <Icone nome="sino" tamanho={18} /> Ativar lembretes neste aparelho
        </button>
      )}
      {estado === 'ligado' && (
        <>
          <p className="linha-icone">
            <Icone nome="concluido" tamanho={20} /> Lembretes ativados neste aparelho.
          </p>
          <div className="linha-botoes">
            <button
              className="botao"
              disabled={ocupado || !logado}
              onClick={() =>
                void executar(async () => {
                  const { enviadas, falhas } = await enviarTeste()
                  if (enviadas) return 'Notificação de teste enviada.'
                  if (falhas) throw new Error('Não foi possível entregar a notificação agora. Tente de novo em instantes.')
                  return 'Nenhum aparelho inscrito para receber.'
                })
              }
            >
              <Icone nome="sino" tamanho={18} /> Enviar teste
            </button>
            <button className="botao" disabled={ocupado} onClick={() => void executar(async () => (await desativarNotificacoes(), 'Lembretes desativados neste aparelho.'))}>
              <Icone nome="sinoDesligado" tamanho={18} /> Desativar
            </button>
          </div>
        </>
      )}
      {mensagem && <p className={mensagem.tipo === 'erro' ? 'erro' : 'sutil'}>{mensagem.texto}</p>}
    </>
  )
}

export function Configuracoes() {
  const prefs = usePreferencias()

  return (
    <section>
      <header className="topo-pagina simples">
        <h1>Configurações</h1>
      </header>

      <div className="cartao">
        <h2>Perfil</h2>
        <Perfil />
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
              <Icone nome={t === 'escuro' ? 'lua' : 'sol'} tamanho={18} /> {t === 'escuro' ? 'Escuro' : 'Claro'}
            </button>
          ))}
        </div>
      </div>

      <div className="cartao">
        <h2>Backup e sincronização</h2>
        <Conta />
      </div>

      <div className="cartao">
        <h2>Notificações e lembretes</h2>
        <Notificacoes />
      </div>

      <div className="cartao">
        <h2>Dados</h2>
        <Dados />
      </div>

      <div className="cartao">
        <h2>Instalar no celular</h2>
        <PassosInstalacao />
      </div>

      <p className="sutil centro">Versão {__VERSAO_APP__}</p>
    </section>
  )
}
