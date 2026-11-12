'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { KeyRound, ArrowRight, ShieldCheck, Eye, EyeOff, Mail, AlertTriangle, CheckCircle2, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function CredentialsForm({
  mode,
  legacyLoginEnabled = false,
  googleEnabled = false,
  githubEnabled = false,
  smtpEnabled = false,
}: {
  mode: 'login' | 'register' | 'recover'
  legacyLoginEnabled?: boolean
  googleEnabled?: boolean
  githubEnabled?: boolean
  smtpEnabled?: boolean
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [registerWithoutEmail, setRegisterWithoutEmail] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpStepRequired, setTotpStepRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [recoverTab, setRecoverTab] = useState<'email' | 'key'>(smtpEnabled ? 'email' : 'key')
  const [resetTokenFromUrl, setResetTokenFromUrl] = useState('')
  const [emailResetSentMessage, setEmailResetSentMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedKey, setSavedKey] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && mode === 'recover') {
      const params = new URLSearchParams(window.location.search)
      const tokenParam = params.get('token')
      if (tokenParam) {
        setResetTokenFromUrl(tokenParam.trim())
      }
    }
  }, [mode])

  const heading =
    mode === 'register'
      ? 'Dein Konto erstellen'
      : mode === 'recover'
        ? resetTokenFromUrl
          ? 'Neues Passwort festlegen'
          : 'Passwort vergessen / Konto retten'
        : 'Willkommen zurück'
  const showSocial = mode !== 'recover' && (googleEnabled || githubEnabled)

  async function login(customIdentifier?: string) {
    const loginId = customIdentifier || username || email
    if (!totpStepRequired && !totpCode.trim()) {
      const preRes = await fetch('/api/account/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'precheck', username: loginId, password }),
      }).catch(() => null)
      if (preRes?.ok) {
        const preData = (await preRes.json()) as { requiresTotp?: boolean }
        if (preData.requiresTotp) {
          setTotpStepRequired(true)
          return
        }
      }
    }
    const result = await signIn('credentials', {
      username: loginId,
      password,
      totpCode: totpCode.trim(),
      redirect: false,
    })
    if (result?.error) {
      throw new Error(
        totpStepRequired
          ? 'Ungültiger 2FA-Code oder Wiederherstellungsschlüssel.'
          : 'Anmeldung fehlgeschlagen. Prüfe deine Angaben oder versuche es später erneut.',
      )
    }
    window.location.assign('/')
  }

  async function loginWithPasskey() {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setError('Dein Browser oder Gerät unterstützt leider keine Passkeys (WebAuthn).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const optRes = await fetch('/api/account/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth_options', username: username.trim() }),
      })
      const optData = await optRes.json()
      if (!optRes.ok) throw new Error(optData.error || 'Passkey-Anmeldung konnte nicht gestartet werden.')

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToUint8Array(optData.challenge),
        rpId: optData.rpId,
        userVerification: 'preferred',
        timeout: 60000,
        ...(Array.isArray(optData.allowCredentials) && optData.allowCredentials.length > 0
          ? {
              allowCredentials: optData.allowCredentials.map((c: { id: string; transports?: AuthenticatorTransport[] }) => ({
                type: 'public-key' as const,
                id: base64UrlToUint8Array(c.id),
                ...(c.transports ? { transports: c.transports } : {}),
              })),
            }
          : {}),
      }

      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('Kein Passkey ausgewählt.')

      const assertion = credential.response as AuthenticatorAssertionResponse
      const verifyRes = await fetch('/api/account/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auth_verify',
          token: optData.token,
          credentialId: arrayBufferToBase64Url(credential.rawId),
          clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(assertion.authenticatorData),
          signature: arrayBufferToBase64Url(assertion.signature),
        }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok || !verifyData.passkeyLoginToken) {
        throw new Error(verifyData.error || 'Passkey konnte nicht verifiziert werden.')
      }

      const result = await signIn('credentials', {
        passkeyLoginToken: verifyData.passkeyLoginToken,
        redirect: false,
      })
      if (result?.error) throw new Error('Passkey-Sitzung konnte nicht erstellt werden.')
      window.location.assign('/')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Passkey-Vorgang wurde abgebrochen.')
      } else {
        setError(err instanceof Error ? err.message : 'Passkey-Anmeldung fehlgeschlagen.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setEmailResetSentMessage('')

    try {
      if (mode === 'login') {
        await login()
        return
      }

      if (mode === 'register') {
        if (!registerWithoutEmail && !email.trim()) {
          throw new Error('Bitte gib deine E-Mail-Adresse ein oder wähle explizit die Registrierung ohne E-Mail.')
        }
        const response = await fetch('/api/account/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            email: registerWithoutEmail ? '' : email.trim(),
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Bitte erneut versuchen.')
        setRecoveryKey(data.recoveryKey)
        return
      }

      // mode === 'recover'
      if (resetTokenFromUrl) {
        const response = await fetch('/api/account/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_email_reset',
            token: resetTokenFromUrl,
            password,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Passwort konnte nicht zurückgesetzt werden.')
        if (data.loginIdentifier) setUsername(data.loginIdentifier)
        setRecoveryKey(data.recoveryKey)
        return
      }

      if (recoverTab === 'email') {
        const response = await fetch('/api/account/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_email_reset',
            identifier: username.trim(),
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'E-Mail konnte nicht gesendet werden.')
        setEmailResetSentMessage(data.message || 'Falls ein Konto mit E-Mail existiert, wurde ein Reset-Link gesendet.')
        return
      }

      // Recovery via local recovery key
      const response = await fetch('/api/account/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          recoveryKey: recoveryInput,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Bitte erneut versuchen.')
      setRecoveryKey(data.recoveryKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <img src="/icon.svg" alt="" className="h-6 w-6" /> Urlaubsplaner
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dein Urlaub und deine Einstellungen auf allen Geräten.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {emailResetSentMessage && (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              E-Mail-Anfrage verarbeitet
            </div>
            <p className="text-xs leading-relaxed">{emailResetSentMessage}</p>
          </div>
        )}

        {recoveryKey ? (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-5 w-5 text-primary" /> Wiederherstellungsschlüssel sichern
            </h2>
            <p className="text-sm text-muted-foreground">
              Speichere diesen Schlüssel in deinem Passwortmanager. Er wird nur jetzt angezeigt und dient als zusätzliches Notfall-Backup für dein Konto.
            </p>
            <textarea
              aria-label="Wiederherstellungsschlüssel"
              readOnly
              value={recoveryKey}
              className="w-full resize-none rounded-lg border bg-muted p-3 font-mono text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={savedKey} onChange={e => setSavedKey(e.target.checked)} /> Ich habe den Schlüssel sicher gespeichert.
            </label>
            <Button
              className="w-full"
              disabled={!savedKey || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await login()
                } catch {
                  setError('Konto gespeichert. Bitte melde dich mit deinem neuen Passwort an.')
                  setBusy(false)
                }
              }}
            >
              Zum Urlaubsplaner <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            {mode === 'login' && !showSocial && (
              <div className="space-y-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="w-full justify-center gap-2 border-primary/30 hover:border-primary"
                  onClick={() => void loginWithPasskey()}
                >
                  <Fingerprint className="h-4 w-4 text-primary" />
                  Mit Passkey anmelden (FaceID / TouchID / Gerät)
                </Button>
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      oder mit Benutzername &amp; Passwort
                    </span>
                  </div>
                </div>
              </div>
            )}

            {showSocial && (
              <div className="space-y-2.5">
                {mode === 'login' && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="w-full justify-center gap-2 border-primary/30 hover:border-primary"
                    onClick={() => void loginWithPasskey()}
                  >
                    <Fingerprint className="h-4 w-4 text-primary" />
                    Mit Passkey anmelden (FaceID / TouchID / Gerät)
                  </Button>
                )}
                {googleEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="w-full justify-center gap-2.5"
                    onClick={() => signIn('google', { callbackUrl: '/' })}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
                      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
                    </svg>
                    Mit Google {mode === 'register' ? 'registrieren' : 'anmelden'}
                  </Button>
                )}
                {githubEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="w-full justify-center gap-2.5"
                    onClick={() => signIn('github', { callbackUrl: '/' })}
                  >
                    <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                    </svg>
                    Mit GitHub {mode === 'register' ? 'registrieren' : 'anmelden'}
                  </Button>
                )}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {mode === 'login' ? 'oder mit E-Mail / Benutzername' : 'oder direkt registrieren'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {mode === 'recover' && !resetTokenFromUrl && (
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => { setRecoverTab('email'); setError('') }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                    recoverTab === 'email' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" /> Per E-Mail
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoverTab('key'); setError('') }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                    recoverTab === 'key' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Mit Notfall-Schlüssel
                </button>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {!resetTokenFromUrl && (
                <div>
                  <label className="block space-y-1.5 text-sm font-medium">
                    {mode === 'register'
                      ? 'Benutzername'
                      : mode === 'recover' && recoverTab === 'email'
                        ? 'Hinterlegte E-Mail-Adresse oder Benutzername'
                        : 'Benutzername oder E-Mail-Adresse'}
                    <input
                      required
                      autoComplete="username"
                      minLength={3}
                      maxLength={mode === 'register' ? 32 : 160}
                      pattern={mode === 'register' ? '[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}' : undefined}
                      placeholder={mode === 'register' ? 'z.B. max.mustermann' : 'name@beispiel.de oder benutzername'}
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    />
                  </label>
                  {mode === 'register' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      3–32 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.
                    </p>
                  )}
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-2.5">
                  {!registerWithoutEmail ? (
                    <label className="block space-y-1.5 text-sm font-medium">
                      E-Mail-Adresse
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        placeholder="name@beispiel.de"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                      />
                      <span className="block text-xs font-normal text-muted-foreground">
                        Ermöglicht Anmeldung per E-Mail, „Passwort vergessen“-Mails sowie die automatische Verknüpfung mit Google/GitHub.
                      </span>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Registrierung ohne E-Mail-Adresse
                      </div>
                      <p className="leading-relaxed">
                        Ohne E-Mail-Adresse können wir dir bei Passwortverlust <strong>keine Reset-E-Mail</strong> zusenden und dein Konto nicht automatisch über deine E-Mail mit Google verknüpfen. Du kannst dein Passwort dann nur mit deinem Wiederherstellungsschlüssel zurücksetzen.
                      </p>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={registerWithoutEmail}
                      onChange={e => {
                        setRegisterWithoutEmail(e.target.checked)
                        if (e.target.checked) setEmail('')
                      }}
                      className="rounded border"
                    />
                    Ohne E-Mail-Adresse registrieren (nur mit Benutzername &amp; Notfall-Schlüssel)
                  </label>
                </div>
              )}

              {mode === 'recover' && !resetTokenFromUrl && recoverTab === 'key' && (
                <label className="block space-y-1.5 text-sm font-medium">
                  Wiederherstellungsschlüssel
                  <input
                    required
                    autoComplete="off"
                    value={recoveryInput}
                    onChange={e => setRecoveryInput(e.target.value.trim())}
                    className="min-h-11 w-full rounded-lg border bg-background px-3 font-mono text-xs"
                  />
                </label>
              )}

              {(mode !== 'recover' || resetTokenFromUrl || recoverTab === 'key') && (
                <div>
                  <label className="block space-y-1.5 text-sm font-medium">
                    {mode === 'recover' ? 'Neues Passwort' : 'Passwort'}
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={mode === 'login' ? 1 : 6}
                        maxLength={128}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="min-h-11 w-full rounded-lg border bg-background pl-3 pr-10 font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  {mode !== 'login' && <p className="mt-1 text-xs text-muted-foreground">Mindestens 6 Zeichen.</p>}
                </div>
              )}

              {mode === 'login' && totpStepRequired && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-2">
                  <label className="block space-y-1 text-sm font-medium">
                    <span className="flex items-center gap-1.5 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                      Zwei-Faktor-Code (Authenticator-App)
                    </span>
                    <input
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-stelliger Code (oder Notfall-Schlüssel)"
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value)}
                      className="min-h-11 w-full rounded-lg border bg-background px-3 font-mono text-sm tracking-widest"
                    />
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Gib den 6-stelligen Code aus deiner Authenticator-App (oder deinen Wiederherstellungsschlüssel) ein.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {mode === 'recover' && !resetTokenFromUrl && recoverTab === 'email' ? (
                  <>
                    <Mail className="h-4 w-4" />
                    {busy ? 'Bitte warten…' : 'Reset-Link per E-Mail anfordern'}
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    {busy
                      ? 'Bitte warten…'
                      : mode === 'login'
                        ? 'Anmelden'
                        : mode === 'register'
                          ? 'Konto erstellen'
                          : 'Passwort zurücksetzen'}
                  </>
                )}
              </Button>
            </form>
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-primary">
          {mode !== 'login' && <Link href="/login">Anmelden</Link>}
          {mode !== 'register' && <Link href="/register">Konto erstellen</Link>}
          {mode !== 'recover' && <Link href="/recover">Passwort vergessen?</Link>}
        </div>

        {legacyLoginEnabled && mode === 'login' && (
          <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => signIn('keycloak', { callbackUrl: '/' })}>
            Bestehendes Keycloak-Konto anmelden
          </Button>
        )}
      </div>
    </main>
  )
}
