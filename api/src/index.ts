import { criarApp } from './app.js'
import { iniciarAgendador } from './lembretes.js'
import { migrar } from './migrar.js'

const porta = Number(process.env.PORT ?? 3333)

await migrar()
criarApp().listen(porta, () => console.log(`API ouvindo em http://localhost:${porta}`))
iniciarAgendador()
