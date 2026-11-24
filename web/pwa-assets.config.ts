import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones de Android, iOS e favicon a partir de public/logo.svg.
// Rode `npm run icones` sempre que trocar o logo.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // O logo.svg já tem margem interna; sem padding extra o símbolo fica no tamanho certo
    // e ainda dentro da área segura (80% central) do recorte do Android.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#090C15' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#090C15' } },
  },
  images: ['public/logo.svg'],
})
