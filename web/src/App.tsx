import { lazy, Suspense, useEffect, useState } from 'react'
import { AvisoAtualizacao } from './components/AvisoAtualizacao'
import { IndicadorSync } from './components/IndicadorSync'
import { NavInferior, type Aba } from './components/NavInferior'
import { usePortao } from './conta/portao'
import { TelaInicial } from './conta/TelaInicial'
import { BannerInstalacao } from './components/OrientacaoInstalacao'
import { BarraCronometro } from './habitos/BarraCronometro'
import { Confetes } from './habitos/Confetes'
import { useCronometro } from './habitos/cronometro'
import { usePreferencias } from './preferencias'
import { Habitos } from './pages/Habitos'

// Abas carregadas sob demanda: a abertura do app baixa só o necessário para Hábitos.
// O service worker guarda todos os pedaços, então tudo continua funcionando offline.
const Academia = lazy(() => import('./pages/Academia').then((m) => ({ default: m.Academia })))
const Estatisticas = lazy(() => import('./pages/Estatisticas').then((m) => ({ default: m.Estatisticas })))
const Configuracoes = lazy(() => import('./pages/Configuracoes').then((m) => ({ default: m.Configuracoes })))

function abaDaUrl(): Aba {
  const h = location.hash.replace('#', '')
  return h === 'academia' || h === 'estatisticas' || h === 'configuracoes' ? h : 'habitos'
}

export function App() {
  const [aba, setAba] = useState<Aba>(abaDaUrl)
  const { tema } = usePreferencias()
  const { cron } = useCronometro()
  const portao = usePortao()

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tema === 'escuro' ? '#090C15' : '#F6F5F6')
  }, [tema])

  // O botão "voltar" do Android troca de aba em vez de fechar o app.
  useEffect(() => {
    const aoMudar = () => setAba(abaDaUrl())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  function trocar(a: Aba) {
    if (a !== aba) location.hash = a
  }

  // Sem conta conectada, a tela inicial (criar conta / entrar) vem antes do app.
  if (portao === 'carregando') return null
  if (portao === 'visitante') {
    return (
      <>
        <TelaInicial />
        <AvisoAtualizacao />
      </>
    )
  }

  return (
    <div className={`app ${cron ? 'com-barra' : ''}`}>
      <IndicadorSync />
      <BannerInstalacao />
      <main className="conteudo">
        <Suspense fallback={null}>
          {aba === 'habitos' && <Habitos />}
          {aba === 'academia' && <Academia />}
          {aba === 'estatisticas' && <Estatisticas />}
          {aba === 'configuracoes' && <Configuracoes />}
        </Suspense>
      </main>
      <BarraCronometro />
      <Confetes />
      <AvisoAtualizacao />
      <NavInferior aba={aba} onTrocar={trocar} />
    </div>
  )
}
