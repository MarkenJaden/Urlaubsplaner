import type { Metadata } from 'next'
import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Passwort zurücksetzen',
  description: 'Setze dein Passwort per E-Mail-Link oder Wiederherstellungsschlüssel zurück.',
  alternates: { canonical: '/recover' },
  robots: { index: false, follow: true },
}

export default async function RecoverPage() {
  const status = await getPublicOAuthStatus()
  return <CredentialsForm mode="recover" smtpEnabled={status.smtpEnabled} />
}
