export interface SeoRegionEntry {
  slug: string
  name: string
  shortName?: string
  country: 'DE' | 'AT' | 'CH'
  subdivision?: string
  preposition: string
  highlight: string
}

export const SEO_REGIONS: SeoRegionEntry[] = [
  {
    slug: 'baden-wuerttemberg',
    name: 'Baden-Württemberg',
    shortName: 'BW',
    country: 'DE',
    subdivision: 'DE-BW',
    preposition: 'in Baden-Württemberg',
    highlight:
      'Mit Heilige Drei Könige (6. Januar), Fronleichnam und Allerheiligen gehört Baden-Württemberg zu den Bundesländern mit besonders vielen Brückentag-Chancen.',
  },
  {
    slug: 'bayern',
    name: 'Bayern',
    shortName: 'BY',
    country: 'DE',
    subdivision: 'DE-BY',
    preposition: 'in Bayern',
    highlight:
      'Bayern bietet mit Heilige Drei Könige, Fronleichnam, Mariä Himmelfahrt und Allerheiligen die meisten gesetzlichen Feiertage in Deutschland – ideal für maximale freie Tage.',
  },
  {
    slug: 'berlin',
    name: 'Berlin',
    shortName: 'BE',
    country: 'DE',
    subdivision: 'DE-BE',
    preposition: 'in Berlin',
    highlight:
      'Berlin punktet zusätzlich zu den bundesweiten Feiertagen mit dem Internationalen Frauentag am 8. März – perfekt für einen frühen Kurzurlaub im Frühjahr.',
  },
  {
    slug: 'brandenburg',
    name: 'Brandenburg',
    shortName: 'BB',
    country: 'DE',
    subdivision: 'DE-BB',
    preposition: 'in Brandenburg',
    highlight:
      'In Brandenburg sorgt unter anderem der Reformationstag am 31. Oktober gemeinsam mit Ostern, Christi Himmelfahrt und Pfingsten für attraktive lange Wochenenden.',
  },
  {
    slug: 'bremen',
    name: 'Bremen',
    shortName: 'HB',
    country: 'DE',
    subdivision: 'DE-HB',
    preposition: 'in Bremen',
    highlight:
      'Durch den Reformationstag am 31. Oktober sowie Christi Himmelfahrt und die Maifeiertage lassen sich in Bremen mit wenigen Urlaubstagen lange Freizeitblöcke kombinieren.',
  },
  {
    slug: 'hamburg',
    name: 'Hamburg',
    shortName: 'HH',
    country: 'DE',
    subdivision: 'DE-HH',
    preposition: 'in Hamburg',
    highlight:
      'In Hamburg ermöglichen der Reformationstag im Herbst sowie die Frühjahrs-Feiertage rund um Himmelfahrt und Pfingsten sehr effiziente Brückentage.',
  },
  {
    slug: 'hessen',
    name: 'Hessen',
    shortName: 'HE',
    country: 'DE',
    subdivision: 'DE-HE',
    preposition: 'in Hessen',
    highlight:
      'Dank Fronleichnam (immer an einem Donnerstag) gibt es in Hessen jedes Jahr einen zusätzlichen garantierten Brückentag am Freitag neben Christi Himmelfahrt.',
  },
  {
    slug: 'mecklenburg-vorpommern',
    name: 'Mecklenburg-Vorpommern',
    shortName: 'MV',
    country: 'DE',
    subdivision: 'DE-MV',
    preposition: 'in Mecklenburg-Vorpommern',
    highlight:
      'Mit dem Internationalen Frauentag (8. März) und dem Reformationstag (31. Oktober) bietet Mecklenburg-Vorpommern gleich zwei starke regionale Feiertage.',
  },
  {
    slug: 'niedersachsen',
    name: 'Niedersachsen',
    shortName: 'NI',
    country: 'DE',
    subdivision: 'DE-NI',
    preposition: 'in Niedersachsen',
    highlight:
      'In Niedersachsen lässt sich neben den klassischen Frühjahrs-Brückentagen auch der Reformationstag am 31. Oktober optimal für einen Herbsturlaub einplanen.',
  },
  {
    slug: 'nordrhein-westfalen',
    name: 'Nordrhein-Westfalen',
    shortName: 'NRW',
    country: 'DE',
    subdivision: 'DE-NW',
    preposition: 'in Nordrhein-Westfalen (NRW)',
    highlight:
      'NRW profitiert von Fronleichnam (immer donnerstags) sowie Allerheiligen am 1. November – ideal für lange Wochenenden im Frühsommer und Spätherbst.',
  },
  {
    slug: 'rheinland-pfalz',
    name: 'Rheinland-Pfalz',
    shortName: 'RLP',
    country: 'DE',
    subdivision: 'DE-RP',
    preposition: 'in Rheinland-Pfalz',
    highlight:
      'Mit Fronleichnam und Allerheiligen stehen Arbeitnehmerinnen und Arbeitnehmern in Rheinland-Pfalz 11 gesetzliche Feiertage mit hoher Brückentags-Effizienz zur Verfügung.',
  },
  {
    slug: 'saarland',
    name: 'Saarland',
    shortName: 'SL',
    country: 'DE',
    subdivision: 'DE-SL',
    preposition: 'im Saarland',
    highlight:
      'Das Saarland zählt mit Fronleichnam, Mariä Himmelfahrt (15. August) und Allerheiligen (1. November) zu den feiertagsreichsten Regionen Deutschlands.',
  },
  {
    slug: 'sachsen',
    name: 'Sachsen',
    shortName: 'SN',
    country: 'DE',
    subdivision: 'DE-SN',
    preposition: 'in Sachsen',
    highlight:
      'Einzigartig in Deutschland: Der Buß- und Bettag fällt in Sachsen immer auf einen Mittwoch im November – mit 2 Urlaubstagen (Do/Fr) entstehen garantiert 5 freie Tage.',
  },
  {
    slug: 'sachsen-anhalt',
    name: 'Sachsen-Anhalt',
    shortName: 'ST',
    country: 'DE',
    subdivision: 'DE-ST',
    preposition: 'in Sachsen-Anhalt',
    highlight:
      'Sachsen-Anhalt kombiniert Heilige Drei Könige (6. Januar) zum Jahresstart mit dem Reformationstag (31. Oktober) im Herbst für starke Urlaubsblöcke.',
  },
  {
    slug: 'schleswig-holstein',
    name: 'Schleswig-Holstein',
    shortName: 'SH',
    country: 'DE',
    subdivision: 'DE-SH',
    preposition: 'in Schleswig-Holstein',
    highlight:
      'Durch den Reformationstag am 31. Oktober sowie Ostern, Christi Himmelfahrt und Pfingsten gelingt in Schleswig-Holstein eine besonders effiziente Jahresplanung.',
  },
  {
    slug: 'thueringen',
    name: 'Thüringen',
    shortName: 'TH',
    country: 'DE',
    subdivision: 'DE-TH',
    preposition: 'in Thüringen',
    highlight:
      'Thüringen hat mit dem Weltkindertag am 20. September und dem Reformationstag am 31. Oktober attraktive Spätsommer- und Herbst-Feiertage.',
  },
  {
    slug: 'oesterreich',
    name: 'Österreich',
    shortName: 'AT',
    country: 'AT',
    preposition: 'in Österreich',
    highlight:
      'Mit 13 bundesweiten gesetzlichen Feiertagen (u. a. Heilige Drei Könige, Fronleichnam, Mariä Himmelfahrt, Nationalfeiertag, Allerheiligen, Mariä Empfängnis) bietet Österreich enorme Fenstertag-Vorteile.',
  },
  {
    slug: 'schweiz',
    name: 'Schweiz',
    shortName: 'CH',
    country: 'CH',
    preposition: 'in der Schweiz',
    highlight:
      'Plane Auffahrt, Pfingsten, den Bundesfeiertag am 1. August und kantonale Feiertage clever im Schweizer Brückentage-Kalender.',
  },
]

export function getSeoRegionBySlug(slug: string): SeoRegionEntry | undefined {
  return SEO_REGIONS.find(r => r.slug === slug.toLowerCase())
}

export function getSeoPlanningYears(referenceDate = new Date()): number[] {
  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(referenceDate)
  )
  return [currentYear, currentYear + 1, currentYear + 2]
}

export function isValidSeoYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2024 && year <= 2030
}

export function buildPlannerHref(params: {
  year?: number
  country?: string
  subdivision?: string
}): string {
  const search = new URLSearchParams()
  if (params.year) search.set('year', String(params.year))
  if (params.country) search.set('country', params.country)
  if (params.subdivision) search.set('subdivision', params.subdivision)
  const qs = search.toString()
  return qs ? `/?${qs}` : '/'
}
