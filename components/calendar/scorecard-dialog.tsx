'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Trophy, Share2, Download, Copy, Check, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { formatDays } from '@/lib/vacation-accounting'
import type { PlanScorecard } from '@/lib/vacation-scorecard'

interface ScorecardDialogProps {
  open: boolean
  onClose: () => void
  scorecard: PlanScorecard
  regionLabel: string
  workDaysLabel: string
  onOpenSuggestions?: () => void
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function ScorecardDialog({
  open,
  onClose,
  scorecard,
  regionLabel,
  workDaysLabel,
  onOpenSuggestions,
}: ScorecardDialogProps) {
  const [showTopPeriods, setShowTopPeriods] = useState(true)
  const [copiedText, setCopiedText] = useState(false)
  const [busyImage, setBusyImage] = useState(false)

  const investedDays = scorecard.vacationDaysUsed + scorecard.gleittageUsed
  const efficiencyText = scorecard.efficiency > 0 ? scorecard.efficiency.toFixed(1).replace('.', ',') : '0,0'

  const topPeriods = [...scorecard.periods]
    .sort((a, b) => {
      const effA = a.freeCalendarDays / Math.max(0.5, a.vacationCost + a.gleittagCount)
      const effB = b.freeCalendarDays / Math.max(0.5, b.vacationCost + b.gleittagCount)
      return effB - effA || b.freeCalendarDays - a.freeCalendarDays
    })
    .slice(0, 3)

  const shareText =
    investedDays > 0
      ? `🌴 Mein Urlaubs-Hack ${scorecard.year} (${regionLabel}): Aus ${formatDays(investedDays)} Urlaubstagen hole ich ${scorecard.totalFreeDaysInBlocks} freie Tage raus (${efficiencyText}× Effizienz, längste Pause: ${scorecard.longestBreakDays} Tage)! Wie viel schaffst du in deinem Bundesland? 👉 https://urlaubsplaner.me`
      : `🌴 Plane deinen Jahresurlaub ${scorecard.year} optimal mit Brückentagen, Schulferien-Heatmap & Paar-Abgleich – 100 % kostenlos & ohne Anmeldung: https://urlaubsplaner.me`

  const buildScorecardBlob = async (): Promise<Blob | null> => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1350
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 1080, 1350)
    bg.addColorStop(0, '#0f172a')
    bg.addColorStop(0.55, '#1e293b')
    bg.addColorStop(1, '#064e3b')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 1080, 1350)

    // Subtle decorative glow
    const glow = ctx.createRadialGradient(860, 240, 40, 860, 240, 460)
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.22)')
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, 1080, 1350)

    // Top brand pill
    drawRoundedRect(ctx, 76, 76, 360, 62, 31)
    ctx.fillStyle = 'rgba(37, 99, 235, 0.25)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#e0f2fe'
    ctx.font = 'bold 26px Inter, system-ui, sans-serif'
    ctx.fillText('urlaubsplaner.me', 110, 116)

    // Region & Year badge
    ctx.fillStyle = '#6ee7b7'
    ctx.font = '600 26px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${regionLabel} · ${scorecard.year}`, 1004, 116)
    ctx.textAlign = 'left'

    // Title
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 30px Inter, system-ui, sans-serif'
    ctx.fillText(`MEIN URLAUBS-SCORE ${scorecard.year}`, 76, 235)

    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 74px Inter, system-ui, sans-serif'
    ctx.fillText(`${scorecard.totalFreeDaysInBlocks} freie Tage`, 76, 330)

    ctx.fillStyle = '#38bdf8'
    ctx.font = '700 44px Inter, system-ui, sans-serif'
    ctx.fillText(`aus nur ${formatDays(investedDays)} eingesetzten Tagen`, 76, 398)

    // KPI Cards Grid
    const cards = [
      { label: 'Effizienz-Faktor', value: `${efficiencyText}×`, sub: 'Freie Tage pro Urlaubstag', accent: '#34d399' },
      { label: 'Geschenkte Tage', value: `+${formatDays(scorecard.bonusFreeDays)}`, sub: 'Durch Feiertage & Wochenenden', accent: '#38bdf8' },
      { label: 'Längste Auszeit', value: `${scorecard.longestBreakDays} Tage`, sub: 'Am Stück erholen', accent: '#fbbf24' },
      { label: 'Arbeitsmodell', value: workDaysLabel.split(' ')[0] || '5-Tage', sub: workDaysLabel, accent: '#c084fc' },
    ]

    cards.forEach((card, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 76 + col * 476
      const y = 465 + row * 215
      drawRoundedRect(ctx, x, y, 452, 190, 28)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.58)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 24px Inter, system-ui, sans-serif'
      ctx.fillText(card.label, x + 32, y + 52)

      ctx.fillStyle = card.accent
      ctx.font = '800 58px Inter, system-ui, sans-serif'
      ctx.fillText(card.value, x + 32, y + 124)

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '500 21px Inter, system-ui, sans-serif'
      ctx.fillText(card.sub, x + 32, y + 162)
    })

    // Top efficiency periods (optional, privacy-safe: only month + day ratio, never note titles)
    if (showTopPeriods && topPeriods.length > 0) {
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '700 26px Inter, system-ui, sans-serif'
      ctx.fillText('Meine stärksten Brückentag-Blöcke:', 76, 945)

      topPeriods.forEach((p, idx) => {
        const y = 972 + idx * 72
        drawRoundedRect(ctx, 76, y, 928, 58, 16)
        ctx.fillStyle = 'rgba(30, 41, 59, 0.75)'
        ctx.fill()

        const monthName = format(parseISO(p.freeStartDate), 'MMMM', { locale: de })
        const cost = p.vacationCost + p.gleittagCount
        ctx.fillStyle = '#f8fafc'
        ctx.font = '600 24px Inter, system-ui, sans-serif'
        ctx.fillText(`${monthName} (${p.weekLabel})`, 104, y + 37)

        ctx.fillStyle = '#6ee7b7'
        ctx.font = '700 24px Inter, system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`${formatDays(cost)} UT → ${p.freeCalendarDays} Tage frei`, 976, y + 37)
        ctx.textAlign = 'left'
      })
    }

    // Bottom CTA footer
    drawRoundedRect(ctx, 76, 1215, 928, 72, 20)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'
    ctx.fill()
    ctx.fillStyle = '#ecfdf5'
    ctx.font = '700 26px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Wie viel holst du raus? Kostenlos testen auf urlaubsplaner.me', 540, 1260)
    ctx.textAlign = 'left'

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'))
  }

  const handleShareOrDownloadImage = async (preferNativeShare: boolean) => {
    setBusyImage(true)
    try {
      const blob = await buildScorecardBlob()
      if (!blob) return
      const fileName = `urlaubs-score-${scorecard.year}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      if (
        preferNativeShare &&
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `Mein Urlaubs-Score ${scorecard.year}`,
          text: shareText,
          files: [file],
        })
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 3000)
    } catch {
      // User cancelled share sheet or browser blocked download
    } finally {
      setBusyImage(false)
    }
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" /> Mein Urlaubs-Score {scorecard.year}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          Teile deine Brückentage-Ausbeute als Story-/Status-Karte auf WhatsApp, Instagram oder mit Kollegen – 100 % ohne private Notizen.
        </p>

        {investedDays === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-5 text-center space-y-3">
            <p className="text-sm font-medium">
              Du hast für {scorecard.year} noch keine Urlaubstage eingetragen.
            </p>
            <p className="text-xs text-muted-foreground">
              Lass dir in 3 Sekunden vom Smart-Optimierer die besten Brückentage für {regionLabel} berechnen!
            </p>
            {onOpenSuggestions && (
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenSuggestions()
                }}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Jetzt {scorecard.year} optimal planen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Preview Card */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-5 text-slate-50 shadow-lg space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-blue-500/20 border border-blue-400/40 px-2.5 py-0.5 font-semibold text-sky-200">
                  urlaubsplaner.me
                </span>
                <span className="font-medium text-emerald-300">
                  {regionLabel} · {scorecard.year}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Mein Urlaubs-Score {scorecard.year}
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-white mt-0.5">
                  {scorecard.totalFreeDaysInBlocks} freie Tage
                </p>
                <p className="text-sm font-semibold text-sky-300">
                  aus nur {formatDays(investedDays)} eingesetzten Tagen
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-950/50 border border-slate-700/60 p-2.5">
                  <div className="text-lg font-bold text-emerald-400">{efficiencyText}×</div>
                  <div className="text-[10px] text-slate-300">Effizienz</div>
                </div>
                <div className="rounded-xl bg-slate-950/50 border border-slate-700/60 p-2.5">
                  <div className="text-lg font-bold text-sky-400">+{formatDays(scorecard.bonusFreeDays)}</div>
                  <div className="text-[10px] text-slate-300">Bonus-Tage</div>
                </div>
                <div className="rounded-xl bg-slate-950/50 border border-slate-700/60 p-2.5">
                  <div className="text-lg font-bold text-amber-400">{scorecard.longestBreakDays}T</div>
                  <div className="text-[10px] text-slate-300">Längste Pause</div>
                </div>
              </div>

              {showTopPeriods && topPeriods.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-700/60 text-xs">
                  {topPeriods.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-900/70 px-2.5 py-1.5">
                      <span className="text-slate-200">
                        {format(parseISO(p.freeStartDate), 'MMMM', { locale: de })} ({p.weekLabel})
                      </span>
                      <span className="font-semibold text-emerald-300">
                        {formatDays(p.vacationCost + p.gleittagCount)} UT → {p.freeCalendarDays} Tage frei
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-emerald-500/20 py-1.5 text-center text-[11px] font-semibold text-emerald-100">
                Wie viel holst du raus? → urlaubsplaner.me
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <span>Top-Monate auf der Grafik einblenden (ohne private Notizen)</span>
              <Switch checked={showTopPeriods} onCheckedChange={setShowTopPeriods} />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                disabled={busyImage}
                onClick={() => void handleShareOrDownloadImage(true)}
                className="w-full"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Story-Bild teilen
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyImage}
                onClick={() => void handleShareOrDownloadImage(false)}
                className="w-full"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Als Bild (.png) speichern
              </Button>
            </div>

            <Button type="button" variant="outline" onClick={() => void handleCopyText} className="hidden" />
            <Button type="button" variant="outline" onClick={handleCopyText} className="w-full text-xs">
              {copiedText ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copiedText ? 'Spruch & Link kopiert!' : 'Text für WhatsApp / Gruppenchat kopieren'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
