import type { Metadata } from 'next'
import { legacyLoginEnabled } from '@/auth'
import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Anmelden',
  description: 'Melde dich bei deinem Urlaubsplaner-Konto an, um deine Urlaubsplanung auf allen Geräten zu synchronisieren.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
}

export default async function LoginPage() {
  const oauth = await getPublicOAuthStatus()
  return (
    <CredentialsForm
      mode="login"
      legacyLoginEnabled={legacyLoginEnabled}
      googleEnabled={oauth.googleEnabled}
      githubEnabled={oauth.githubEnabled}
    />
  )
}
