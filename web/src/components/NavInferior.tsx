import { Icone, type NomeIcone } from './Icone'

export type Aba = 'habitos' | 'academia' | 'estatisticas' | 'configuracoes'

const ABAS: { id: Aba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'habitos', rotulo: 'Hábitos', icone: 'habitos' },
  { id: 'academia', rotulo: 'Academia', icone: 'academia' },
  { id: 'estatisticas', rotulo: 'Estatísticas', icone: 'estatisticas' },
  { id: 'configuracoes', rotulo: 'Configurações', icone: 'configuracoes' },
]

export function NavInferior({ aba, onTrocar }: { aba: Aba; onTrocar: (a: Aba) => void }) {
  return (
    <nav className="nav-inferior" aria-label="Navegação principal">
      {ABAS.map((a) => (
        <button
          key={a.id}
          className={a.id === aba ? 'ativa' : ''}
          aria-current={a.id === aba ? 'page' : undefined}
          onClick={() => onTrocar(a.id)}
        >
          <span className="nav-icone">
            <Icone nome={a.icone} tamanho={22} espessura={a.id === aba ? 2.2 : 1.8} />
          </span>
          <span className="nav-rotulo">{a.rotulo}</span>
        </button>
      ))}
    </nav>
  )
}
