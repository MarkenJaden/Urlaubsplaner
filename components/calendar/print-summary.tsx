'use client'

import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { de } from 'date-fns/locale'
import { formatDays } from '@/lib/vacation-accounting'
import { DEFAULT_APPROVAL_SHEET_CONFIG, type ApprovalSheetConfig, type VacationEntry } from '@/types'
import type { PlanScorecard } from '@/lib/vacation-scorecard'

interface PrintSummaryHeaderProps {
  year: number
  regionLabel: string
  workDaysLabel: string
  scorecard: PlanScorecard
  carryoverDays?: number
  entries?: VacationEntry[]
  approvalConfig?: ApprovalSheetConfig
  mode: 'calendar' | 'request'
}

function fmtShortDate(iso: string): string {
  return format(parseISO(iso), 'dd.MM.yyyy (EE)', { locale: de })
}

export function ApprovalSheetDocument({
  year,
  regionLabel,
  workDaysLabel,
  scorecard,
  carryoverDays = 0,
  entries = [],
  config: rawConfig,
  isPreview = false,
}: {
  year: number
  regionLabel: string
  workDaysLabel: string
  scorecard: PlanScorecard
  carryoverDays?: number
  entries?: VacationEntry[]
  config?: ApprovalSheetConfig
  isPreview?: boolean
}) {
  const cfg = { ...DEFAULT_APPROVAL_SHEET_CONFIG, ...rawConfig }
  const todayFormatted = format(new Date(), 'dd.MM.yyyy', { locale: de })
  const locationDateText = cfg.locationDate.trim() || todayFormatted

  const vacationDates = new Set(
    entries.filter(e => e.type === 'vacation').map(e => e.date.slice(0, 10)),
  )
  const gleittagDates = new Set(
    entries.filter(e => e.type === 'gleittag').map(e => e.date.slice(0, 10)),
  )

  const signatureColumns =
    1 + (cfg.showSupervisorSignature ? 1 : 0) + (cfg.showHrSignature ? 1 : 0)

  return (
    <div
      className={`text-slate-900 bg-white ${
        isPreview
          ? 'rounded-xl border border-slate-300 p-6 shadow-md text-xs'
          : 'text-xs'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-wrap items-start justify-between gap-4 pb-3 ${
          cfg.headerLayout === 'modern'
            ? 'rounded-lg bg-slate-900 text-white p-4'
            : cfg.headerLayout === 'minimal'
              ? 'border-b border-slate-300'
              : 'border-b-2 border-slate-800'
        }`}
      >
        <div>
          <p
            className={`text-lg font-bold tracking-tight ${
              cfg.headerLayout === 'modern' ? 'text-white' : 'text-slate-900'
            }`}
          >
            {cfg.title.trim() || 'Urlaubsantrag / Jahresurlaubsplanung'} {year}
          </p>
          {cfg.subtitle.trim() && (
            <p
              className={`text-xs font-medium mt-0.5 ${
                cfg.headerLayout === 'modern' ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              {cfg.subtitle.trim()}
            </p>
          )}
          {cfg.showRegionAndWorkDays && (
            <p
              className={`text-[11px] mt-0.5 ${
                cfg.headerLayout === 'modern' ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              Region: {regionLabel} · Arbeitszeitmodell: {workDaysLabel}
            </p>
          )}
        </div>

        {cfg.showSummaryBox && (
          <div
            className={`text-right text-[11px] space-y-0.5 ${
              cfg.headerLayout === 'modern' ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            <div>
              Urlaubsanspruch {year}:{' '}
              <strong>{formatDays(scorecard.vacationDaysUsed)}</strong> /{' '}
              <strong>{formatDays(scorecard.vacationDaysTotal)}</strong> Tage beantragt (
              <strong>{formatDays(scorecard.vacationDaysRemaining)}</strong> verbleibend)
            </div>
            {cfg.showCarryoverInSummary && carryoverDays > 0 && (
              <div>
                Davon Resturlaub aus Vorjahr: <strong>{formatDays(carryoverDays)} Tage</strong>
              </div>
            )}
            {cfg.showGleittage && scorecard.gleittageUsed > 0 && (
              <div>
                Geplante Gleittage: <strong>{scorecard.gleittageUsed}</strong>
              </div>
            )}
            {cfg.showEfficiency && scorecard.efficiency > 0 && (
              <div>
                Zusammenhängend frei: <strong>{scorecard.totalFreeDaysInBlocks} Tage</strong> (
                {scorecard.efficiency.toFixed(1).replace('.', ',')}× Effizienz)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Employee / Department / Supervisor Metadata Grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-slate-300 bg-slate-50/60 p-3.5">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
            Mitarbeiter/in {cfg.employeeId.trim() ? '(Name / Personalnr.)' : '(Name)'}
          </span>
          <div className="mt-1 min-h-[1.35rem] border-b border-slate-400 font-semibold text-slate-900">
            {cfg.employeeName.trim() || cfg.employeeId.trim() ? (
              <span>
                {cfg.employeeName.trim()}
                {cfg.employeeName.trim() && cfg.employeeId.trim() ? ` · Pers.-Nr. ${cfg.employeeId.trim()}` : cfg.employeeId.trim() ? `Pers.-Nr. ${cfg.employeeId.trim()}` : ''}
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
            Abteilung / Team / Kostenstelle
          </span>
          <div className="mt-1 min-h-[1.35rem] border-b border-slate-400 font-medium text-slate-900">
            {cfg.department.trim() || null}
          </div>
        </div>

        {(cfg.supervisorName.trim() || cfg.substituteName.trim()) && (
          <>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Vorgesetzte/r / Genehmigung durch
              </span>
              <div className="mt-1 min-h-[1.25rem] border-b border-slate-400 font-medium text-slate-900">
                {cfg.supervisorName.trim() || null}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Reguläre Vertretung
              </span>
              <div className="mt-1 min-h-[1.25rem] border-b border-slate-400 font-medium text-slate-900">
                {cfg.substituteName.trim() || null}
              </div>
            </div>
          </>
        )}
      </div>

      {cfg.customNote.trim() && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 whitespace-pre-line">
          {cfg.customNote.trim()}
        </div>
      )}

      {/* Periods Table */}
      <div className="mt-4">
        {scorecard.periods.length === 0 ? (
          <p className="py-6 text-center text-slate-500 border rounded">
            Für {year} sind aktuell noch keine Urlaubs- oder Gleittage eingetragen.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b-2 border-slate-700 bg-slate-100 text-slate-900">
                <th className="py-1.5 px-2 font-semibold">#</th>
                <th className="py-1.5 px-2 font-semibold">Beantragter Zeitraum (Erster – Letzter Urlaubstag)</th>
                {cfg.showCalendarWeek && <th className="py-1.5 px-2 font-semibold">KW</th>}
                <th className="py-1.5 px-2 text-right font-semibold">Urlaubstage</th>
                {cfg.showGleittage && <th className="py-1.5 px-2 text-right font-semibold">Gleittage</th>}
                {cfg.showCalendarDays && (
                  <th className="py-1.5 px-2 text-right font-semibold">Kalendertage</th>
                )}
                {cfg.showSubstituteColumn && (
                  <th className="py-1.5 px-2 font-semibold">Vertretung / Bemerkung</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {scorecard.periods.map((period, index) => {
                const rangeLabel =
                  period.bookedStartDate === period.bookedEndDate
                    ? fmtShortDate(period.bookedStartDate)
                    : `${fmtShortDate(period.bookedStartDate)} – ${fmtShortDate(period.bookedEndDate)}`
                const noteText =
                  period.titles.length > 0
                    ? period.titles.join(', ')
                    : cfg.substituteName.trim()
                return (
                  <tr key={`${period.bookedStartDate}-${index}`}>
                    <td className="py-1.5 px-2 text-slate-500">{index + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{rangeLabel}</td>
                    {cfg.showCalendarWeek && (
                      <td className="py-1.5 px-2 text-slate-600">{period.weekLabel}</td>
                    )}
                    <td className="py-1.5 px-2 text-right font-semibold">
                      {period.vacationCost > 0 ? formatDays(period.vacationCost) : '—'}
                    </td>
                    {cfg.showGleittage && (
                      <td className="py-1.5 px-2 text-right">
                        {period.gleittagCount > 0 ? period.gleittagCount : '—'}
                      </td>
                    )}
                    {cfg.showCalendarDays && (
                      <td className="py-1.5 px-2 text-right text-slate-600">
                        {period.freeCalendarDays} Tage
                      </td>
                    )}
                    {cfg.showSubstituteColumn && (
                      <td className="py-1.5 px-2 text-slate-600 min-w-[130px]">{noteText}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800 bg-slate-50 font-semibold">
                <td colSpan={cfg.showCalendarWeek ? 3 : 2} className="py-2 px-2">
                  Summe {year} (Restanspruch: {formatDays(scorecard.vacationDaysRemaining)} Tage)
                </td>
                <td className="py-2 px-2 text-right">{formatDays(scorecard.vacationDaysUsed)}</td>
                {cfg.showGleittage && (
                  <td className="py-2 px-2 text-right">
                    {scorecard.gleittageUsed > 0 ? scorecard.gleittageUsed : '—'}
                  </td>
                )}
                {cfg.showCalendarDays && (
                  <td className="py-2 px-2 text-right">{scorecard.totalFreeDaysInBlocks} Tage</td>
                )}
                {cfg.showSubstituteColumn && <td className="py-2 px-2" />}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Optional Compact 12-Month Mini Overview on the Request Sheet */}
      {cfg.showMiniCalendar && (
        <div className="mt-4 rounded border border-slate-200 p-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-700">
            <span>Jahres-Kalenderübersicht {year}</span>
            <span className="flex items-center gap-3 font-normal text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-xs bg-blue-600" /> Urlaub
              </span>
              {cfg.showGleittage && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-xs bg-purple-600" /> Gleittag
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, m) => {
              const monthStart = startOfMonth(new Date(year, m, 1))
              const days = eachDayOfInterval({
                start: monthStart,
                end: endOfMonth(monthStart),
              })
              const offset = (monthStart.getDay() + 6) % 7
              return (
                <div key={m} className="rounded border border-slate-200 p-1">
                  <div className="text-[9px] font-bold text-slate-700 mb-0.5 capitalize">
                    {format(monthStart, 'MMM', { locale: de })}
                  </div>
                  <div className="grid grid-cols-7 gap-px text-[7px] text-center">
                    {Array.from({ length: offset }).map((_, i) => (
                      <span key={`e-${i}`} />
                    ))}
                    {days.map(d => {
                      const k = format(d, 'yyyy-MM-dd')
                      const isVac = vacationDates.has(k)
                      const isGleit = gleittagDates.has(k)
                      return (
                        <span
                          key={k}
                          className={`rounded-xs leading-tight py-px ${
                            isVac
                              ? 'bg-blue-600 text-white font-bold'
                              : isGleit
                                ? 'bg-purple-600 text-white font-bold'
                                : 'text-slate-600'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Signature Row */}
      <div
        className={`grid gap-8 pt-6 ${
          signatureColumns === 3
            ? 'grid-cols-3'
            : signatureColumns === 2
              ? 'grid-cols-2'
              : 'grid-cols-1 max-w-xs'
        }`}
      >
        <div>
          <div className="flex min-h-[3.25rem] flex-col justify-end border-b border-slate-500 pb-1">
            {cfg.signatureMode === 'draw' && cfg.signatureDataUrl ? (
              <div className="flex items-end justify-between gap-2">
                <span className="text-[10px] text-slate-600">{locationDateText}</span>
                <img
                  src={cfg.signatureDataUrl}
                  alt="Digitale Unterschrift"
                  className="max-h-11 object-contain"
                />
              </div>
            ) : cfg.signatureMode === 'type' && (cfg.signatureTypedText.trim() || cfg.employeeName.trim()) ? (
              <div className="flex items-end justify-between gap-2">
                <span className="text-[10px] text-slate-600">{locationDateText}</span>
                <span
                  className="text-base italic font-serif tracking-wide text-slate-900"
                  style={{ fontFamily: 'Georgia, "Times New Roman", cursive, serif' }}
                >
                  {cfg.signatureTypedText.trim() || cfg.employeeName.trim()}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500">{locationDateText}</span>
            )}
          </div>
          <span className="mt-1 block text-[10px] text-slate-600">
            Datum, Unterschrift Mitarbeiter/in
            {cfg.employeeName.trim() ? ` (${cfg.employeeName.trim()})` : ''}
          </span>
        </div>

        {cfg.showSupervisorSignature && (
          <div>
            <div className="min-h-[3.25rem] border-b border-slate-500" />
            <span className="mt-1 block text-[10px] text-slate-600">
              Datum, Genehmigung Vorgesetzte/r
              {cfg.supervisorName.trim() ? ` (${cfg.supervisorName.trim()})` : ''}
            </span>
          </div>
        )}

        {cfg.showHrSignature && (
          <div>
            <div className="min-h-[3.25rem] border-b border-slate-500" />
            <span className="mt-1 block text-[10px] text-slate-600">
              Datum, Personalabteilung (HR)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function PrintSummaryHeader({
  year,
  regionLabel,
  workDaysLabel,
  scorecard,
  carryoverDays = 0,
  entries = [],
  approvalConfig,
  mode,
}: PrintSummaryHeaderProps) {
  if (mode === 'request') {
    return (
      <div className="hidden print:block print:mb-3 text-black">
        <ApprovalSheetDocument
          year={year}
          regionLabel={regionLabel}
          workDaysLabel={workDaysLabel}
          scorecard={scorecard}
          carryoverDays={carryoverDays}
          entries={entries}
          config={approvalConfig}
        />
      </div>
    )
  }

  return (
    <div className="hidden print:block print:mb-3 text-black">
      <div className="flex items-end justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-lg font-bold tracking-tight text-slate-900">
            Jahres-Urlaubsplan {year}
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
          </div>
        </div>
      </div>
    </div>
  )
}

export function PrintSummaryFooter() {
  return (
    <div className="hidden print:flex items-center justify-between border-t border-slate-300 pt-2 mt-3 text-[10px] text-slate-500">
      <span>
        Erstellt mit <strong>urlaubsplaner.me</strong>
      </span>
      <span>Stand: {format(new Date(), 'dd.MM.yyyy', { locale: de })}</span>
    </div>
  )
}
