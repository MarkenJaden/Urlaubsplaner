'use client'

import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { formatDays } from '@/lib/vacation-accounting'
import type { PlanScorecard } from '@/lib/vacation-scorecard'

interface PrintSummaryHeaderProps {
  year: number
  regionLabel: string
  workDaysLabel: string
  scorecard: PlanScorecard
  mode: 'calendar' | 'request'
}

function fmtShortDate(iso: string): string {
  return format(parseISO(iso), 'dd.MM.yyyy (EE)', { locale: de })
}

export function PrintSummaryHeader({
  year,
  regionLabel,
  workDaysLabel,
  scorecard,
  mode,
}: PrintSummaryHeaderProps) {
  return (
    <div className="hidden print:block print:mb-3 text-black">
      <div className="flex items-end justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-lg font-bold tracking-tight text-slate-900">
            {mode === 'request' ? `Urlaubsantrag / Jahresübersicht ${year}` : `Jahres-Urlaubsplan ${year}`}
          </p>
          <p className="text-[11px] text-slate-600">
            Region: {regionLabel} · Arbeitsmodell: {workDaysLabel}
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-800">
          <div>
            Urlaubsanspruch: <strong>{formatDays(scorecard.vacationDaysUsed)}</strong> /{' '}
            <strong>{formatDays(scorecard.vacationDaysTotal)}</strong> Tage verplant (
            <strong>{formatDays(scorecard.vacationDaysRemaining)}</strong> übrig)
          </div>
          <div>
            {scorecard.gleittageUsed > 0 && (
              <span>Gleittage: <strong>{scorecard.gleittageUsed}</strong> · </span>
            )}
            Zusammenhängend frei: <strong>{scorecard.totalFreeDaysInBlocks} Tage</strong>
            {scorecard.efficiency > 0 && (
              <span> ({scorecard.efficiency.toFixed(1).replace('.', ',')}× Effizienz)</span>
            )}
          </div>
        </div>
      </div>

      {mode === 'request' && (
        <div className="mt-4 space-y-4 text-xs text-slate-900">
          <div className="grid grid-cols-2 gap-6 rounded border border-slate-300 p-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Mitarbeiter/in (Name / Personalnr.)
              </span>
              <div className="mt-4 border-b border-slate-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Abteilung / Team
              </span>
              <div className="mt-4 border-b border-slate-400" />
            </div>
          </div>

          {scorecard.periods.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              Für {year} sind aktuell noch keine Urlaubs- oder Gleittage eingetragen.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-700 bg-slate-100 text-slate-900">
                  <th className="py-1.5 px-2 font-semibold">#</th>
                  <th className="py-1.5 px-2 font-semibold">Beantragter Zeitraum (Erster – Letzter Tag)</th>
                  <th className="py-1.5 px-2 font-semibold">KW</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Urlaubstage</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Gleittage</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Frei inkl. WE/Feiertag</th>
                  <th className="py-1.5 px-2 font-semibold">Vertretung / Hinweis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scorecard.periods.map((period, index) => {
                  const rangeLabel =
                    period.bookedStartDate === period.bookedEndDate
                      ? fmtShortDate(period.bookedStartDate)
                      : `${fmtShortDate(period.bookedStartDate)} – ${fmtShortDate(period.bookedEndDate)}`
                  return (
                    <tr key={`${period.bookedStartDate}-${index}`}>
                      <td className="py-1.5 px-2 text-slate-500">{index + 1}</td>
                      <td className="py-1.5 px-2 font-medium">{rangeLabel}</td>
                      <td className="py-1.5 px-2 text-slate-600">{period.weekLabel}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">
                        {period.vacationCost > 0 ? formatDays(period.vacationCost) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {period.gleittagCount > 0 ? period.gleittagCount : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-600">
                        {period.freeCalendarDays} Tage
                      </td>
                      <td className="py-1.5 px-2 text-slate-600 min-w-[130px]">
                        {period.titles.length > 0 ? period.titles.join(', ') : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-50 font-semibold">
                  <td colSpan={3} className="py-2 px-2">
                    Summe {year} (Restanspruch: {formatDays(scorecard.vacationDaysRemaining)} Tage)
                  </td>
                  <td className="py-2 px-2 text-right">{formatDays(scorecard.vacationDaysUsed)}</td>
                  <td className="py-2 px-2 text-right">
                    {scorecard.gleittageUsed > 0 ? scorecard.gleittageUsed : '—'}
                  </td>
                  <td className="py-2 px-2 text-right">{scorecard.totalFreeDaysInBlocks} Tage</td>
                  <td className="py-2 px-2" />
                </tr>
              </tfoot>
            </table>
          )}

          <div className="grid grid-cols-2 gap-10 pt-8">
            <div>
              <div className="border-b border-slate-500 pt-6" />
              <span className="mt-1 block text-[10px] text-slate-600">
                Datum, Unterschrift Mitarbeiter/in
              </span>
            </div>
            <div>
              <div className="border-b border-slate-500 pt-6" />
              <span className="mt-1 block text-[10px] text-slate-600">
                Datum, Genehmigung Vorgesetzte/r / Personalabteilung
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function PrintSummaryFooter() {
  return (
    <div className="hidden print:flex items-center justify-between border-t border-slate-300 pt-2 mt-3 text-[10px] text-slate-500">
      <span>
        Erstellt mit <strong>urlaubsplaner.me</strong> – Kostenloser Brückentage-, Ferien- &amp; Paar-Urlaubsplaner
      </span>
      <span>Stand: {format(new Date(), 'dd.MM.yyyy', { locale: de })}</span>
    </div>
  )
}
