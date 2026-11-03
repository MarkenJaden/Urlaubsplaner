import { legacyLoginEnabled } from '@/auth'
import { getPublicOAuthStatus } from '@/lib/admin'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'

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
