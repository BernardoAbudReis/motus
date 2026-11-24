import { useEffect, useState } from 'react'
import { AvisoAtualizacao } from './components/AvisoAtualizacao'
import { IndicadorSync } from './components/IndicadorSync'
import { NavInferior, type Aba } from './components/NavInferior'
import { BannerInstalacao } from './components/OrientacaoInstalacao'
import { BarraCronometro } from './habitos/BarraCronometro'
import { useCronometro } from './habitos/cronometro'
import { usePreferencias } from './preferencias'
import { Academia } from './pages/Academia'
import { Configuracoes } from './pages/Configuracoes'
import { Estatisticas } from './pages/Estatisticas'
import { Habitos } from './pages/Habitos'

function abaDaUrl(): Aba {
  const h = location.hash.replace('#', '')
  return h === 'academia' || h === 'estatisticas' || h === 'configuracoes' ? h : 'habitos'
}

export function App() {
  const [aba, setAba] = useState<Aba>(abaDaUrl)
  const { tema } = usePreferencias()
  const { cron } = useCronometro()

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

  return (
    <div className={`app ${cron ? 'com-barra' : ''}`}>
      <IndicadorSync />
      <BannerInstalacao />
      <main className="conteudo">
        {aba === 'habitos' && <Habitos />}
        {aba === 'academia' && <Academia />}
        {aba === 'estatisticas' && <Estatisticas />}
        {aba === 'configuracoes' && <Configuracoes />}
      </main>
      <BarraCronometro />
      <AvisoAtualizacao />
      <NavInferior aba={aba} onTrocar={trocar} />
    </div>
  )
}
