import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: 'Urlaubsplaner',
  description: 'Persönlicher Urlaubsplaner mit Feiertagsintegration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <footer className="container py-6 text-xs text-muted-foreground">
            <a href="/datenschutz" className="underline">Datenschutz</a>
          </footer>
        </Providers>
      </body>
    </html>
  )
}
