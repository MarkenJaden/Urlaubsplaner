import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-xl border border-border bg-card shadow-lg">
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
