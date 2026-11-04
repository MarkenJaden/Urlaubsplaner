import type { Metadata } from 'next'
import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Konto erstellen',
  description: 'Erstelle ein kostenloses Konto beim Urlaubsplaner für Cloud-Synchronisierung und Kalender-Abonnements.',
  alternates: { canonical: '/register' },
  robots: { index: false, follow: true },
}

export default async function RegisterPage() {
  const oauth = await getPublicOAuthStatus()
  return (
    <CredentialsForm
      mode="register"
      googleEnabled={oauth.googleEnabled}
      githubEnabled={oauth.githubEnabled}
    />
  )
}
