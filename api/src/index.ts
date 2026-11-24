import { criarApp } from './app.js'
import { iniciarBackups } from './backup.js'
import { iniciarAgendador } from './lembretes.js'
import { migrar } from './migrar.js'

const porta = Number(process.env.PORT ?? 3333)

await migrar()
criarApp().listen(porta, () => console.log(`API ouvindo em http://localhost:${porta}`))
iniciarAgendador()
if (process.env.NODE_ENV === 'production' || process.env.BACKUP_DIR) iniciarBackups()
