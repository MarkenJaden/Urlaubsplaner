'use client'

import { useMemo } from 'react'
import { Combobox } from '@/components/ui/combobox'
import type { ComboboxOption } from '@/components/ui/combobox'
import { getSubdivisionAliases } from '@/lib/subdivision-aliases'
import { localizedName } from '@/lib/holiday-regions'
import type { Country, HolidayGroup, Subdivision } from '@/types'

export interface LocationFieldsProps {
  countries: Country[]
  country: string
  onCountryChange: (code: string) => void
  subdivisions: Subdivision[]
  subdivision?: string
  onSubdivisionChange: (code: string) => void
  /** Holiday groups that apply to the selected subdivision. */
  groups: HolidayGroup[]
  holidayGroup?: string
  onHolidayGroupChange: (code: string) => void
}

/** Home country → region → holiday group (school holiday region or school type). */
export function LocationFields({
  countries, country, onCountryChange,
  subdivisions, subdivision, onSubdivisionChange,
  groups, holidayGroup, onHolidayGroupChange,
}: LocationFieldsProps) {
  const regionNoun = country === 'DE' ? 'Bundesland' : 'Region'
  const countryOptions: ComboboxOption[] = useMemo(() =>
    countries.map(c => ({ value: c.isoCode, label: localizedName(c.name, c.isoCode), aliases: [c.isoCode] })),
  [countries])
  const subdivisionOptions: ComboboxOption[] = useMemo(() =>
    subdivisions.map(s => ({ value: s.code, label: localizedName(s.name, s.shortName ?? s.code), aliases: [s.shortName, ...getSubdivisionAliases(s.code)].filter(Boolean) as string[] })),
  [subdivisions])
  const groupOptions: ComboboxOption[] = useMemo(() =>
    groups.map(g => ({ value: g.code, label: localizedName(g.name, g.code), aliases: [g.code, g.shortName ?? ''] })),
  [groups])

  return (
    <>
      {countryOptions.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mein Land</label>
          <Combobox
            options={countryOptions}
            value={country}
            onChange={onCountryChange}
            placeholder="Land wählen..."
            searchPlaceholder="z.B. Niederlande, NL..."
            emptyText="Kein Land gefunden"
          />
        </div>
      )}

      {subdivisions.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mein {regionNoun}</label>
          <Combobox
            options={subdivisionOptions}
            value={subdivision}
            onChange={onSubdivisionChange}
            placeholder={`${regionNoun} wählen...`}
            searchPlaceholder={country === 'DE' ? 'z.B. NRW, Bayern...' : 'Suchen...'}
            emptyText="Keine Region gefunden"
          />
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Ferienregion / Schulart</label>
          <Combobox
            options={groupOptions}
            value={holidayGroup}
            onChange={onHolidayGroupChange}
            placeholder="Ferienregion wählen..."
            searchPlaceholder="z.B. Nord, Mitte, Süd..."
            emptyText="Keine Ferienregion gefunden"
          />
          <p className="text-xs text-muted-foreground mt-0.5">Bestimmt, welche Schulferien für dich gelten.</p>
        </div>
      )}
    </>
  )
}
