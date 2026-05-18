export const dynamic = 'force-dynamic'

import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Urlaubsplaner</h1>
          <p className="text-muted-foreground text-sm">
            Melde dich an, um deinen Urlaub zu planen.
          </p>
        </div>
        <form
          action={async () => {
            'use server'
            await signIn('keycloak', { redirectTo: '/' })
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            Mit Keycloak anmelden
          </Button>
        </form>
      </div>
    </div>
  )
}
