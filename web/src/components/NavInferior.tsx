export type Aba = 'habitos' | 'academia' | 'estatisticas' | 'configuracoes'

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: 'habitos', rotulo: 'Hábitos', icone: '✅' },
  { id: 'academia', rotulo: 'Academia', icone: '🏋️' },
  { id: 'estatisticas', rotulo: 'Estatísticas', icone: '📊' },
  { id: 'configuracoes', rotulo: 'Configurações', icone: '⚙️' },
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
          <span className="nav-icone" aria-hidden>
            {a.icone}
          </span>
          <span className="nav-rotulo">{a.rotulo}</span>
        </button>
      ))}
    </nav>
  )
}
