/** Ícones de traço fino, na cor do texto (currentColor). */
const CAMINHOS = {
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  play: 'M8 5.5v13l10.5-6.5z',
  pausa: 'M8.5 5.5v13M15.5 5.5v13',
  fechar: 'M6 6l12 12M18 6L6 18',
  voltar: 'M15 5l-7 7 7 7',
  avancar: 'M9 5l7 7-7 7',
  arquivo: 'M4 7h16M5 7l1 12h12l1-12M9 11h6M4 4h16v3H4z',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  subir: 'M6 15l6-6 6 6',
  descer: 'M6 9l6 6 6-6',
  lixeira: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  copiar: 'M8 8h11v11H8zM5 16V5h11',
  relogio: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  grafico: 'M4 19h16M6 16l4-5 3 3 5-7',
  minimizar: 'M6 9l6 6 6-6',
  chama:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Icone({ nome, tamanho = 24, preenchido = false }: { nome: NomeIcone; tamanho?: number; preenchido?: boolean }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={preenchido || nome === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}
