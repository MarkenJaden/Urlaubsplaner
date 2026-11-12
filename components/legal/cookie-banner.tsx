'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ShieldCheck, SlidersHorizontal, X } from 'lucide-react'

export interface CookieConsentState {
  version: number
  necessary: true
  preferences: boolean
  analytics: boolean
  updatedAt: string
}

const CONSENT_STORAGE_KEY = 'urlaubsplaner_cookie_consent_v1'
const CONSENT_VERSION = 1

export function loadCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentState
    if (parsed && parsed.version === CONSENT_VERSION && parsed.necessary === true) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urlaubsplaner:open-cookie-settings'))
  }
}

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="underline hover:text-foreground transition-colors cursor-pointer"
    >
      Cookie-Einstellungen
    </button>
  )
}

export function CookieBanner() {
  const [mounted, setMounted] = useState(false)
  const [consent, setConsent] = useState<CookieConsentState | null>(null)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [preferencesChecked, setPreferencesChecked] = useState(true)
  const [analyticsChecked, setAnalyticsChecked] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = loadCookieConsent()
    if (saved) {
      setConsent(saved)
      setPreferencesChecked(saved.preferences)
      setAnalyticsChecked(saved.analytics)
      setBannerOpen(false)
    } else {
      setBannerOpen(true)
    }

    const handleOpen = () => {
      const current = loadCookieConsent()
      if (current) {
        setPreferencesChecked(current.preferences)
        setAnalyticsChecked(current.analytics)
      }
      setBannerOpen(true)
      setDetailsOpen(true)
    }

    window.addEventListener('urlaubsplaner:open-cookie-settings', handleOpen)
    return () => window.removeEventListener('urlaubsplaner:open-cookie-settings', handleOpen)
  }, [])

  const saveDecision = useCallback((preferences: boolean, analytics: boolean) => {
    const next: CookieConsentState = {
      version: CONSENT_VERSION,
      necessary: true,
      preferences,
      analytics,
      updatedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
    setConsent(next)
    setPreferencesChecked(preferences)
    setAnalyticsChecked(analytics)
    setBannerOpen(false)
    setDetailsOpen(false)
  }, [])

  if (!mounted) return null

  return (
    <>
      {/* Load self-hosted Umami analytics only after explicit opt-in consent */}
      {consent?.analytics && (
        <Script
          src="https://umami.urlaubsplaner.me/script.js"
          data-website-id="8af961da-2d2b-4cb2-9cb4-8e40fe7ef2d1"
          strategy="afterInteractive"
        />
      )}

      {bannerOpen && (
        <div
          role="dialog"
          aria-modal={detailsOpen ? 'true' : 'false'}
          aria-labelledby="cookie-banner-title"
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none print:hidden"
        >
          <div className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-border bg-card/98 p-4 sm:p-5 text-card-foreground shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="cookie-banner-title" className="text-base font-semibold">
                    Datenschutz &amp; Cookie-Einstellungen
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Transparent, werbefrei und DSGVO- / TDDDG-konform
                  </p>
                </div>
              </div>
              {consent && (
                <button
                  type="button"
                  onClick={() => {
                    setBannerOpen(false)
                    setDetailsOpen(false)
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Wir nutzen technisch notwendige Speicherfunktionen (LocalStorage &amp; Sitzungs-Cookies), damit deine Urlaubsplanung auf deinem Gerät und in deinem Konto zuverlässig funktioniert. Mit deiner freiwilligen Einwilligung helfen uns datenschutzfreundliche, selbst gehostete Statistiken (ohne Werbe-Tracking oder Weigergabe an Dritte), den Urlaubsplaner weiter zu verbessern. Du kannst deine Auswahl jederzeit im Footer unter „Cookie-Einstellungen“ ändern.
            </p>

            {detailsOpen && (
              <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-3.5 text-xs">
                <div className="flex items-start justify-between gap-4 border-b pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">1. Technisch notwendig</span>
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Immer aktiv
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Speichert deinen Urlaubsplan lokal im Browser (`localStorage`), sichert die Anmeldung (Sitzungs- &amp; CSRF-Schutz-Cookie) und merkt sich deine Cookie-Auswahl (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b/f DSGVO).
                    </p>
                  </div>
                  <Switch checked disabled aria-label="Technisch notwendig (immer aktiv)" />
                </div>

                <div className="flex items-start justify-between gap-4 border-b pb-3">
                  <div className="space-y-0.5">
                    <label htmlFor="consent-preferences" className="font-semibold text-foreground cursor-pointer">
                      2. Komfort &amp; Darstellung
                    </label>
                    <p className="text-muted-foreground">
                      Merkt sich erweiterte Ansichts-Optionen wie dein gewähltes Farbschema (Hell-/Dunkelmodus) und lokal eingeblendete Vergleichspläne.
                    </p>
                  </div>
                  <Switch
                    id="consent-preferences"
                    checked={preferencesChecked}
                    onCheckedChange={setPreferencesChecked}
                    aria-label="Komfort und Darstellung"
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <label htmlFor="consent-analytics" className="font-semibold text-foreground cursor-pointer">
                      3. Anonyme Nutzungsstatistik (Umami)
                    </label>
                    <p className="text-muted-foreground">
                      Erfasst anonymisierte Seitenaufrufe über unsere eigene Umami-Instanz in Europa (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Keine Werbe-Cookies, kein Fingerprinting, keine Datenweitergabe an Dritte.
                    </p>
                  </div>
                  <Switch
                    id="consent-analytics"
                    checked={analyticsChecked}
                    onCheckedChange={setAnalyticsChecked}
                    aria-label="Anonyme Nutzungsstatistik"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Link href="/impressum" className="underline hover:text-foreground">
                  Impressum
                </Link>
                <span>·</span>
                <Link href="/datenschutz" className="underline hover:text-foreground">
                  Datenschutzerklärung
                </Link>
                <span>·</span>
                <Link href="/kontakt" className="underline hover:text-foreground">
                  Kontakt
                </Link>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(v => !v)}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {detailsOpen ? 'Details ausblenden' : 'Einstellungen anpassen'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Equal visual prominence for "Nur notwendige" and "Alle akzeptieren" as required by German TDDDG/DSGVO guidelines */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-medium border-foreground/25"
                  onClick={() => saveDecision(false, false)}
                >
                  Nur notwendige
                </Button>
                {detailsOpen && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="font-medium"
                    onClick={() => saveDecision(preferencesChecked, analyticsChecked)}
                  >
                    Auswahl speichern
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="font-medium"
                  onClick={() => saveDecision(true, true)}
                >
                  Alle akzeptieren
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
