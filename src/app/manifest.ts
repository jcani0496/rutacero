import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RutaCero - Control de Deudas',
    short_name: 'RutaCero',
    description: 'Gestiona y planifica tus deudas de manera inteligente.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1220',
    theme_color: '#3B82F6',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
