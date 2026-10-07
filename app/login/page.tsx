import { legacyLoginEnabled } from '@/auth'
import { CredentialsForm } from '@/components/account/credentials-form'

export const dynamic = 'force-dynamic'
export default function LoginPage() { return <CredentialsForm mode="login" legacyLoginEnabled={legacyLoginEnabled} /> }
