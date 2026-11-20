'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SessionContext } from 'next-auth/react'
import {
  Check,
  Code2,
  Copy,
  Eye,
  Flame,
  GraduationCap,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  BarChart3,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useProfile } from '@/hooks/use-profile'
import { getSeoPlanningYears, SEO_REGIONS } from '@/lib/seo-regions'
import type { CalendarWidgetConfig, OptimizationGoal } from '@/types'

type ConfigTab = 'public' | 'personal'
type PublicTypeOption = 'widget' | 'brueckentage' | 'schulferien' | 'heatmap'

const STRATEGY_CHOICES: Array<{ value: OptimizationGoal; label: string }> = [
  { value: 'balanced', label: 'Ausgewogen' },
  { value: 'max_efficiency', label: 'Max. Effizienz' },
  { value: 'long_breaks', label: 'Lange Blöcke' },
  { value: 'distributed', label: 'Über das Jahr' },
  { value: 'mini_breaks', label: 'Kurztrips' },
]

export default function WidgetConfiguratorPage() {
  const sessionCtx = useContext(SessionContext)
  const isAuthenticated = sessionCtx?.status === 'authenticated'
  const isAuthLoading = sessionCtx?.status === 'loading'
  const profile = useProfile(isAuthenticated)

  const years = useMemo(() => getSeoPlanningYears(), [])
  const [activeTab, setActiveTab] = useState<ConfigTab>('public')

  // Tab 1: Public widget state
  const [pubType, setPubType] = useState<PublicTypeOption>('widget')
  const [pubRegion, setPubRegion] = useState<string>('nordrhein-westfalen')
  const [pubYear, setPubYear] = useState<number>(years[1] ?? years[0])
  const [pubView, setPubView] = useState<'calendar' | 'list'>('calendar')
  const [pubGoal, setPubGoal] = useState<OptimizationGoal>('balanced')
  const [pubBudget, setPubBudget] = useState<number>(28)
  const [pubFourDayWeek, setPubFourDayWeek] = useState<boolean>(false)
  const [pubAllowControls, setPubAllowControls] = useState<boolean>(true)
  const [copiedPublicCode, setCopiedPublicCode] = useState(false)
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false)

  // Tab 2: Personal widgets state
  const [widgets, setWidgets] = useState<CalendarWidgetConfig[]>([])
  const [widgetsLoading, setWidgetsLoading] = useState(false)
  const [widgetsError, setWidgetsError] = useState<string | null>(null)
  const [newWidgetName, setNewWidgetName] = useState('')
  const [creatingWidget, setCreatingWidget] = useState(false)
  const [savingWidgetId, setSavingWidgetId] = useState<string | null>(null)
  const [previewWidgetId, setPreviewWidgetId] = useState<string | null>(null)
  const [copiedPersonalKey, setCopiedPersonalKey] = useState<string | null>(null)

  // Read optional initial query params (?mode=...&year=...&region=...&view=...) client-side
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const m = params.get('mode')
    if (m === 'brueckentage' || m === 'schulferien' || m === 'heatmap' || m === 'widget') {
      setPubType(m)
    }
    const r = params.get('region')
    if (r) setPubRegion(r)
    const y = Number(params.get('year'))
    if (Number.isInteger(y) && years.includes(y)) setPubYear(y)
    const v = params.get('view')
    if (v === 'list' || v === 'calendar') setPubView(v)
    if (params.get('tab') === 'personal') setActiveTab('personal')
  }, [years])

  const loadPersonalWidgets = useCallback(async () => {
    if (!isAuthenticated) return
    setWidgetsLoading(true)
    setWidgetsError(null)
    try {
      const res = await fetch('/api/widgets')
      if (!res.ok) {
        setWidgetsError('Persönliche Widgets konnten nicht geladen werden.')
        return
      }
      const data = await res.json()
      setWidgets(Array.isArray(data.widgets) ? data.widgets : [])
    } catch {
      setWidgetsError('Verbindungsfehler beim Laden der Widgets.')
    } finally {
      setWidgetsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      void loadPersonalWidgets()
    } else {
      setWidgets([])
    }
  }, [isAuthenticated, loadPersonalWidgets])

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://urlaubsplaner.me'

  const publicEmbedPath = useMemo(() => {
    if (pubType === 'widget' || pubType === 'heatmap') {
      const qs = new URLSearchParams({
        year: String(pubYear),
        region: pubRegion,
        mode: pubType === 'heatmap' ? 'heatmap' : 'brueckentage',
        view: pubView,
        goal: pubGoal,
        budget: String(pubBudget),
        work: pubFourDayWeek ? '4' : '5',
        controls: pubAllowControls ? '1' : '0',
      })
      return `/embed/widget?${qs.toString()}`
    }

    const qs = new URLSearchParams({
      year: String(pubYear),
      region: pubRegion,
      view: pubView,
    })
    if (pubType === 'brueckentage') {
      qs.set('goal', pubGoal)
      qs.set('budget', String(pubBudget))
    }
    return `/embed/${pubType}?${qs.toString()}`
  }, [pubType, pubYear, pubRegion, pubView, pubGoal, pubBudget, pubFourDayWeek, pubAllowControls])

  const publicFullUrl = `${origin}${publicEmbedPath}`
  const publicHeight =
    pubView === 'calendar' ? (pubType === 'widget' || pubType === 'heatmap' ? 860 : 760) : 440
  const publicIframeSnippet = `<iframe src="${publicFullUrl}" width="100%" height="${publicHeight}" style="border:1px solid #e2e8f0;border-radius:12px" loading="lazy" title="Urlaubsplaner Widget ${pubYear}"></iframe>`

  const handleCopyText = async (text: string, onSuccess: () => void) => {
    try {
      await navigator.clipboard.writeText(text)
      onSuccess()
    } catch {
      // ignore
    }
  }

  const handleCreatePersonalWidget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creatingWidget) return
    setCreatingWidget(true)
    setWidgetsError(null)
    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWidgetName.trim() || `Mein Widget ${widgets.length + 1}`,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setWidgetsError(data?.error || 'Widget konnte nicht erstellt werden.')
        return
      }
      if (data?.widget) {
        setWidgets(prev => [...prev, data.widget])
        setPreviewWidgetId(data.widget.id)
        setNewWidgetName('')
      }
    } finally {
      setCreatingWidget(false)
    }
  }

  const handlePatchWidget = async (
    id: string,
    patch: Partial<CalendarWidgetConfig> & { regenerateToken?: boolean },
  ) => {
    setSavingWidgetId(id)
    setWidgetsError(null)
    try {
      const res = await fetch('/api/widgets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setWidgetsError(data?.error || 'Änderung konnte nicht gespeichert werden.')
        return
      }
      if (data?.widget) {
        setWidgets(prev => prev.map(w => (w.id === id ? data.widget : w)))
      }
    } finally {
      setSavingWidgetId(null)
    }
  }

  const handleDeleteWidget = async (id: string) => {
    setSavingWidgetId(id)
    setWidgetsError(null)
    try {
      const res = await fetch(`/api/widgets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setWidgetsError('Widget konnte nicht gelöscht werden.')
        return
      }
      setWidgets(prev => prev.filter(w => w.id !== id))
      if (previewWidgetId === id) setPreviewWidgetId(null)
    } finally {
      setSavingWidgetId(null)
    }
  }

  const sharedOverlays = profile.data?.preferences?.sharedOverlays ?? []

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kostenlose &amp; DSGVO-konforme Widgets</span>
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Urlaubsplaner-Widgets konfigurieren &amp; einbetten
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Bette öffentliche Brückentage-, Schulferien- und Heatmap-Widgets interaktiv ein – oder erstelle
            persönliche Widgets für deinen eigenen Urlaubsplan mit feingranularer Freigabe.
          </p>
        </div>

        {/* Accessible 2-Tab Navigation */}
        <div
          role="tablist"
          aria-label="Widget-Modus wählen"
          className="inline-flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            id="tab-public"
            aria-selected={activeTab === 'public'}
            aria-controls="panel-public"
            onClick={() => setActiveTab('public')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'public'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Öffentliche Widgets
          </button>
          <button
            type="button"
            role="tab"
            id="tab-personal"
            aria-selected={activeTab === 'personal'}
            aria-controls="panel-personal"
            onClick={() => setActiveTab('personal')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'personal'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Persönliche Widgets {widgets.length > 0 ? `(${widgets.length})` : ''}
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: Public Widgets                                            */}
        {/* ================================================================ */}
        {activeTab === 'public' && (
          <div id="panel-public" role="tabpanel" aria-labelledby="tab-public" className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-2xl border bg-card p-5 space-y-5 h-fit">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  1. Widget-Typ wählen
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPubType('widget')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      pubType === 'widget'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      All-in-One Interaktiv
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Besucher wechseln Brückentage, Ferien, Heatmap &amp; Budget live
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPubType('brueckentage')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      pubType === 'brueckentage'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Brückentage
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Fokus auf optimierte Brückentag-Blöcke
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPubType('schulferien')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      pubType === 'schulferien'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-sky-600" />
                      Schulferien
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Ferienzeiten &amp; Feiertage eines Landes
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPubType('heatmap')
                      setPubView('calendar')
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      pubType === 'heatmap'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-600" />
                      Ferien-Heatmap
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Bundesweite Feriendichte über alle Länder
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <label className="block space-y-1.5 font-medium">
                  Bundesland / Region
                  <select
                    value={pubRegion}
                    onChange={e => setPubRegion(e.target.value)}
                    className="min-h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-normal"
                  >
                    <option value="de">Deutschland (bundesweit)</option>
                    {SEO_REGIONS.map(r => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 font-medium">
                  Standard-Jahr
                  <select
                    value={pubYear}
                    onChange={e => setPubYear(Number(e.target.value))}
                    className="min-h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-normal"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="font-medium">Darstellung</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPubView('calendar')}
                    className={`rounded-lg border py-2 font-medium ${
                      pubView === 'calendar' ? 'border-primary bg-primary/10 text-primary' : ''
                    }`}
                  >
                    12-Monats-Kalender
                  </button>
                  <button
                    type="button"
                    onClick={() => setPubView('list')}
                    className={`rounded-lg border py-2 font-medium ${
                      pubView === 'list' ? 'border-primary bg-primary/10 text-primary' : ''
                    }`}
                  >
                    Kompakte Liste
                  </button>
                </div>
              </div>

              {(pubType === 'widget' || pubType === 'brueckentage') && (
                <div className="space-y-3 border-t pt-4 text-xs">
                  <div className="font-semibold text-muted-foreground">
                    Standard-Einstellungen für Brückentage-Optimierer
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 font-medium">
                      Strategie
                      <select
                        value={pubGoal}
                        onChange={e => setPubGoal(e.target.value as OptimizationGoal)}
                        className="min-h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-normal"
                      >
                        {STRATEGY_CHOICES.map(c => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 font-medium">
                      Urlaubsbudget
                      <select
                        value={pubBudget}
                        onChange={e => setPubBudget(Number(e.target.value))}
                        className="min-h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-normal"
                      >
                        {[15, 20, 25, 28, 30].map(b => (
                          <option key={b} value={b}>
                            {b} Urlaubstage
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {pubType === 'widget' && (
                    <label className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2">
                      <span>4-Tage-Woche (Mo–Do) als Standard</span>
                      <Switch checked={pubFourDayWeek} onCheckedChange={setPubFourDayWeek} />
                    </label>
                  )}
                </div>
              )}

              {(pubType === 'widget' || pubType === 'heatmap') && (
                <div className="border-t pt-3 text-xs">
                  <label className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2">
                    <span>Besucher dürfen Filter im Widget selbst umstellen</span>
                    <Switch checked={pubAllowControls} onCheckedChange={setPubAllowControls} />
                  </label>
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">HTML-Einbettungscode</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        void handleCopyText(publicFullUrl, () => {
                          setCopiedPublicUrl(true)
                          window.setTimeout(() => setCopiedPublicUrl(false), 2000)
                        })
                      }
                    >
                      {copiedPublicUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedPublicUrl ? 'URL kopiert' : 'Link'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        void handleCopyText(publicIframeSnippet, () => {
                          setCopiedPublicCode(true)
                          window.setTimeout(() => setCopiedPublicCode(false), 2000)
                        })
                      }
                    >
                      {copiedPublicCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedPublicCode ? 'Kopiert!' : 'Iframe kopieren'}
                    </Button>
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed">
                  <code>{publicIframeSnippet}</code>
                </pre>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Live-Vorschau (Original-Iframe)</span>
                <a
                  href={publicEmbedPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  In neuem Tab öffnen →
                </a>
              </div>
              <iframe
                key={publicFullUrl}
                src={publicEmbedPath}
                width="100%"
                height={publicHeight}
                style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}
                title="Live-Vorschau Urlaubsplaner Widget"
                className="w-full bg-card shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: Personal Widgets                                          */}
        {/* ================================================================ */}
        {activeTab === 'personal' && (
          <div id="panel-personal" role="tabpanel" aria-labelledby="tab-personal" className="space-y-6">
            {isAuthLoading ? (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                Prüfe Anmeldestatus…
              </div>
            ) : !isAuthenticated ? (
              <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-4 max-w-2xl">
                <div className="flex items-center gap-2 text-base font-bold">
                  <Lock className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <span>Persönliche Urlaubs-Widgets erfordern ein Konto</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Mit einem kostenlosen Konto kannst du beliebig viele eigene Widgets (z. B. für das Team-Intranet,
                  dein privates Dashboard oder Notion) anlegen und pro Widget genau festlegen, ob Notizen, Notiz-Texte,
                  Gleittage, Schulferien, Brückentage oder geteilte Pläne sichtbar sind.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/login">Jetzt anmelden</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/register">Kostenloses Konto erstellen</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <form
                  onSubmit={handleCreatePersonalWidget}
                  className="rounded-2xl border bg-card p-4 sm:p-5 flex flex-wrap items-end gap-3"
                >
                  <label className="flex-1 min-w-[220px] space-y-1 text-xs font-medium">
                    Neues persönliches Widget benennen
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="z.B. Team-Intranet, Familie, Notion-Dashboard…"
                      value={newWidgetName}
                      onChange={e => setNewWidgetName(e.target.value)}
                      className="min-h-9 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                    />
                  </label>
                  <Button type="submit" disabled={creatingWidget || widgets.length >= 15} className="gap-1.5">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {creatingWidget ? 'Erstelle…' : 'Persönliches Widget anlegen'}
                  </Button>
                </form>

                {widgetsError && (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs text-destructive font-medium">
                    {widgetsError}
                  </p>
                )}

                {widgetsLoading ? (
                  <div className="rounded-2xl border bg-card p-8 text-center text-xs text-muted-foreground">
                    Lade deine persönlichen Widgets…
                  </div>
                ) : widgets.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-8 text-center text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-sm text-foreground">
                      Noch keine persönlichen Widgets erstellt
                    </p>
                    <p>
                      Lege oben dein erstes persönliches Widget an, um deinen Urlaubsplan mit individuell gewählten
                      Details per Iframe einzubetten.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {widgets.map(w => {
                      const personalUrl = `${origin}/embed/personal/${w.token}`
                      const personalIframe = `<iframe src="${personalUrl}" width="100%" height="${w.viewMode === 'list' ? 460 : 760}" style="border:1px solid #e2e8f0;border-radius:12px" loading="lazy" title="${w.name} – urlaubsplaner.me"></iframe>`
                      const isBusy = savingWidgetId === w.id
                      const showPreview = previewWidgetId === w.id

                      return (
                        <div key={w.id} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                            <div className="space-y-1 flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  aria-label="Widget-Name"
                                  defaultValue={w.name}
                                  maxLength={60}
                                  onBlur={e => {
                                    const next = e.target.value.trim()
                                    if (next && next !== w.name) {
                                      void handlePatchWidget(w.id, { name: next })
                                    }
                                  }}
                                  className="rounded-md border bg-background px-2.5 py-1 text-sm font-bold"
                                />
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  <BarChart3 className="h-3 w-3" aria-hidden="true" />
                                  {w.viewCount} Aufrufe
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {w.lastViewedAt
                                  ? `Zuletzt geladen: ${new Date(w.lastViewedAt).toLocaleString('de-DE')}`
                                  : 'Noch nicht extern eingebettet'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant={showPreview ? 'secondary' : 'outline'}
                                className="h-8 text-xs gap-1"
                                onClick={() => setPreviewWidgetId(showPreview ? null : w.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {showPreview ? 'Vorschau schließen' : 'Vorschau'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                disabled={isBusy}
                                onClick={() => void handlePatchWidget(w.id, { regenerateToken: true })}
                                title="Alten Embed-Link ungültig machen und neuen Link erzeugen"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Link erneuern
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-destructive hover:text-destructive"
                                disabled={isBusy}
                                onClick={() => void handleDeleteWidget(w.id)}
                                aria-label={`Widget ${w.name} löschen`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Granular Content & Display Options */}
                          <div className="grid gap-4 md:grid-cols-3 text-xs">
                            <div className="space-y-2 rounded-xl border bg-background/60 p-3">
                              <div className="font-semibold text-muted-foreground">Zeitraum &amp; Ansicht</div>
                              <label className="block space-y-1 font-medium">
                                Jahr
                                <select
                                  value={w.year ?? ''}
                                  disabled={isBusy}
                                  onChange={e =>
                                    void handlePatchWidget(w.id, {
                                      year: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  className="min-h-8 w-full rounded-md border bg-background px-2 text-xs font-normal"
                                >
                                  <option value="">Aktuelles Jahr (dynamisch)</option>
                                  {years.map(y => (
                                    <option key={y} value={y}>
                                      Immer {y}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block space-y-1 font-medium">
                                Darstellungsmodus
                                <select
                                  value={w.viewMode}
                                  disabled={isBusy}
                                  onChange={e =>
                                    void handlePatchWidget(w.id, {
                                      viewMode: e.target.value === 'list' ? 'list' : 'calendar',
                                    })
                                  }
                                  className="min-h-8 w-full rounded-md border bg-background px-2 text-xs font-normal"
                                >
                                  <option value="calendar">12-Monats-Kalender</option>
                                  <option value="list">Chronologische Liste</option>
                                </select>
                              </label>
                              <label className="flex items-center justify-between gap-2 pt-1">
                                <span>Legende anzeigen</span>
                                <Switch
                                  checked={w.showLegend}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { showLegend: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Urlaubsstatistik anzeigen</span>
                                <Switch
                                  checked={w.showStats}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { showStats: val })}
                                />
                              </label>
                            </div>

                            <div className="space-y-2 rounded-xl border bg-background/60 p-3">
                              <div className="font-semibold text-muted-foreground">Eigene Einträge</div>
                              <label className="flex items-center justify-between gap-2">
                                <span>Urlaubstage</span>
                                <Switch
                                  checked={w.includeVacations}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeVacations: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Gleittage</span>
                                <Switch
                                  checked={w.includeGleittage}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeGleittage: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Sonderurlaub</span>
                                <Switch
                                  checked={w.includeSpecial}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeSpecial: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Notizen einblenden</span>
                                <Switch
                                  checked={w.includeNotes}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeNotes: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span className="text-[11px]">Notiz-Texte / Titel anzeigen</span>
                                <Switch
                                  checked={w.includeNoteTitles}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeNoteTitles: val })}
                                />
                              </label>
                            </div>

                            <div className="space-y-2 rounded-xl border bg-background/60 p-3">
                              <div className="font-semibold text-muted-foreground">Kalender &amp; Partner</div>
                              <label className="flex items-center justify-between gap-2">
                                <span>Gesetzliche Feiertage</span>
                                <Switch
                                  checked={w.includePublicHolidays}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includePublicHolidays: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Schulferien</span>
                                <Switch
                                  checked={w.includeSchoolHolidays}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeSchoolHolidays: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2">
                                <span>Brückentage</span>
                                <Switch
                                  checked={w.includeBridgeDays}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeBridgeDays: val })}
                                />
                              </label>
                              <label className="flex items-center justify-between gap-2 border-t pt-2">
                                <span>Geteilte Pläne einblenden</span>
                                <Switch
                                  checked={w.includeSharedOverlays}
                                  disabled={isBusy}
                                  onCheckedChange={val => void handlePatchWidget(w.id, { includeSharedOverlays: val })}
                                />
                              </label>
                              {w.includeSharedOverlays && sharedOverlays.length > 0 && (
                                <div className="space-y-1 pt-1 pl-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    Leer = alle aktiven Pläne, sonst gezielt auswählen:
                                  </span>
                                  {sharedOverlays.map(ov => {
                                    const checked = w.sharedOverlayIds.includes(ov.id)
                                    return (
                                      <label key={ov.id} className="flex items-center gap-1.5 text-[11px]">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={isBusy}
                                          onChange={e => {
                                            const nextIds = e.target.checked
                                              ? [...w.sharedOverlayIds, ov.id]
                                              : w.sharedOverlayIds.filter(id => id !== ov.id)
                                            void handlePatchWidget(w.id, { sharedOverlayIds: nextIds })
                                          }}
                                        />
                                        <span
                                          className="h-2 w-2 rounded-full"
                                          style={{ backgroundColor: ov.color }}
                                        />
                                        <span className="truncate">{ov.label}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Embed URL & Code */}
                          <div className="space-y-2 border-t pt-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold flex items-center gap-1 text-muted-foreground">
                                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                                Einbettungscode &amp; Direktlink (Geheim-Token)
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    void handleCopyText(personalUrl, () => {
                                      setCopiedPersonalKey(`url-${w.id}`)
                                      window.setTimeout(() => setCopiedPersonalKey(null), 2000)
                                    })
                                  }
                                >
                                  {copiedPersonalKey === `url-${w.id}` ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  Link kopieren
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    void handleCopyText(personalIframe, () => {
                                      setCopiedPersonalKey(`iframe-${w.id}`)
                                      window.setTimeout(() => setCopiedPersonalKey(null), 2000)
                                    })
                                  }
                                >
                                  {copiedPersonalKey === `iframe-${w.id}` ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  HTML-Code kopieren
                                </Button>
                              </div>
                            </div>
                            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-2 font-mono text-[11px]">
                              <code>{personalIframe}</code>
                            </pre>
                          </div>

                          {showPreview && (
                            <div className="pt-2">
                              <iframe
                                key={`${w.id}-${w.token}-${w.viewMode}-${w.year}-${w.includeVacations}-${w.includeNotes}-${w.includeNoteTitles}-${w.includeSharedOverlays}-${w.showLegend}-${w.showStats}`}
                                src={`/embed/personal/${w.token}`}
                                width="100%"
                                height={w.viewMode === 'list' ? 460 : 760}
                                style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}
                                title={`Vorschau ${w.name}`}
                                className="w-full bg-card"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DSGVO Note */}
        <section className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Datenschutz &amp; DSGVO bei eingebetteten Widgets</p>
            <p>
              Alle <code>/embed/*</code>-Widgets arbeiten vollständig ohne Cookies, ohne Consent-Banner und ohne
              Tracking-Skripte. Für anonyme Nutzungsstatistiken im Admin-Bereich werden ausschließlich Tages-Summen
              nach Widget-Typ, optionaler Region und gekürztem Einbettungs-Hostnamen (ohne IP-Adressen, ohne URLs
              und ohne Besucher-IDs) erfasst.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
