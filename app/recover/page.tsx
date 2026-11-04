import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

export default async function RecoverPage() {
  const status = await getPublicOAuthStatus()
  return <CredentialsForm mode="recover" smtpEnabled={status.smtpEnabled} />
}
