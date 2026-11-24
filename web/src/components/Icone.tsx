import {
  Archive,
  ArchiveRestore,
  ChartColumn,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Copy,
  Download,
  Dumbbell,
  Flame,
  ListChecks,
  LogOut,
  Minus,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share,
  Sun,
  Timer,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'

/**
 * Ícones da interface: conjunto Lucide, traço fino e monocromático, na cor do
 * texto (currentColor). O destaque vem da cor do elemento (menta), nunca de
 * ícones coloridos. Emojis ficam só nos hábitos, onde o usuário os escolhe.
 */
const ICONES = {
  mais: Plus,
  menos: Minus,
  check: Check,
  concluido: CircleCheck,
  play: Play,
  pausa: Pause,
  fechar: X,
  voltar: ChevronLeft,
  avancar: ChevronRight,
  subir: ChevronUp,
  descer: ChevronDown,
  minimizar: ChevronDown,
  arquivo: Archive,
  desarquivar: ArchiveRestore,
  editar: Pencil,
  lixeira: Trash2,
  copiar: Copy,
  relogio: Clock,
  cronometro: Timer,
  busca: Search,
  grafico: ChartLine,
  chama: Flame,
  habitos: ListChecks,
  academia: Dumbbell,
  estatisticas: ChartColumn,
  configuracoes: Settings,
  compartilhar: Share,
  instalar: Download,
  sincronizar: RefreshCw,
  sair: LogOut,
  lua: Moon,
  sol: Sun,
} satisfies Record<string, LucideIcon>

export type NomeIcone = keyof typeof ICONES

/** Ícones que leem melhor preenchidos (forma sólida em vez de contorno). */
const SOLIDOS = new Set<NomeIcone>(['play', 'pausa'])

export function Icone({
  nome,
  tamanho = 24,
  preenchido,
  espessura = 2,
}: {
  nome: NomeIcone
  tamanho?: number
  preenchido?: boolean
  espessura?: number
}) {
  const Componente = ICONES[nome]
  const solido = preenchido ?? SOLIDOS.has(nome)
  return (
    <Componente
      size={tamanho}
      strokeWidth={espessura}
      fill={solido ? 'currentColor' : 'none'}
      absoluteStrokeWidth={false}
      aria-hidden
      focusable={false}
    />
  )
}
