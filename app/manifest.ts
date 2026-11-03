import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Urlaubsplaner – Brückentage, Schulferien & Optimale Urlaubsplanung',
    short_name: 'Urlaubsplaner',
    description: 'Kostenloser Online-Urlaubsplaner mit Brückentagen, Schulferien-Heatmap, gemeinsamem Teilen und Google-Kalender-Synchronisierung.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
