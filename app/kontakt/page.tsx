'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, Phone, MapPin, Send } from 'lucide-react'

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // Honeypot
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')

    if (name.trim().length < 2) {
      setError('Bitte gib deinen Namen ein.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.')
      return
    }
    if (subject.trim().length < 3) {
      setError('Bitte gib einen kurzen Betreff an.')
      return
    }
    if (message.trim().length < 10) {
      setError('Deine Nachricht sollte mindestens 10 Zeichen lang sein.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Senden fehlgeschlagen.')
      }
      setSent(true)
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Senden der Nachricht.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container max-w-3xl space-y-6 py-8 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-primary underline font-medium">
          ← Zurück zum Urlaubsplaner
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link href="/impressum" className="underline hover:text-foreground">
            Impressum
          </Link>
          <span>·</span>
          <Link href="/datenschutz" className="underline hover:text-foreground">
            Datenschutzerklärung
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Kontakt &amp; Feedback</h1>
        <p className="mt-1 text-muted-foreground">
          Hast du eine Frage, einen Verbesserungsvorschlag oder einen Fehler entdeckt? Schreib mir direkt über das Formular oder per E-Mail.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl border bg-card p-5 shadow-xs">
          {sent ? (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Vielen Dank für deine Nachricht!</h2>
              <p className="text-muted-foreground">
                Deine Anfrage wurde erfolgreich übermittelt. Ich melde mich schnellstmöglich bei dir zurück.
              </p>
              <Button type="button" variant="outline" onClick={() => setSent(false)}>
                Weitere Nachricht schreiben
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <div
                  id="contact-form-error"
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive"
                >
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className="block text-xs font-semibold">
                    Dein Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Max Mustermann"
                    aria-describedby={error ? 'contact-form-error' : undefined}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className="block text-xs font-semibold">
                    Deine E-Mail-Adresse <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    aria-describedby={error ? 'contact-form-error' : undefined}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-subject" className="block text-xs font-semibold">
                  Betreff <span className="text-destructive">*</span>
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="z. B. Feedback zum Urlaubsplaner / Frage zu Schulferien"
                  className={inputClass}
                />
              </div>

              {/* Hidden Honeypot against spam bots */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="contact-website">Website (bitte leer lassen)</label>
                <input
                  id="contact-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="block text-xs font-semibold">
                  Nachricht <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={5}
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Schreibe hier deine Nachricht..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Mit dem Absenden erklärst du dich damit einverstanden, dass deine Angaben zur Beantwortung deiner Anfrage gemäß unserer{' '}
                <Link href="/datenschutz" className="underline">
                  Datenschutzerklärung
                </Link>{' '}
                verarbeitet werden.
              </p>

              <Button type="submit" aria-busy={busy} className="w-full sm:w-auto">
                <Send className="mr-1.5 h-4 w-4" />
                {busy ? 'Wird gesendet…' : 'Nachricht absenden'}
              </Button>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold text-base">Direkter Kontakt</h2>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Jan Jaden Schmidt</p>
                  <p>Johannes-Rau-Weg 17</p>
                  <p>57223 Kreuztal</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href="mailto:info@urlaubsplaner.me" className="text-primary underline break-all">
                  info@urlaubsplaner.me
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href="tel:+4917641792918" className="text-primary underline">
                  0176 41792918
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
