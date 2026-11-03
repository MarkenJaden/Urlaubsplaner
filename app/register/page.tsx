import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

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
