import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { pedirArmazenamentoPersistente } from './db'
import { capturarEventoInstalacao } from './instalacao'
import { iniciarSincronizacaoAutomatica } from './sync'
import './estilos.css'
import './habitos.css'
import './academia.css'
import './cartoes.css'
import './estatisticas.css'

// O evento de instalação pode disparar antes do React montar: captura já.
capturarEventoInstalacao()
void pedirArmazenamentoPersistente()
iniciarSincronizacaoAutomatica()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
