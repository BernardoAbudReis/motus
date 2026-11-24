import { Icone } from '../components/Icone'

export function Estatisticas() {
  return (
    <section>
      <header className="topo-pagina simples">
        <h1>Estatísticas</h1>
      </header>
      <div className="vazio">
        <span className="vazio-icone" aria-hidden>
          <Icone nome="estatisticas" tamanho={30} />
        </span>
        <p className="vazio-titulo">Em breve</p>
        <p>Consistência, sequências, frequência na academia e evolução de cargas entram na próxima fase.</p>
      </div>
    </section>
  )
}
