/**
 * Aliases for German federal states (Bundesländer).
 * Maps subdivision codes to common abbreviations and alternative names
 * so users can search by e.g. "NRW" and find "Nordrhein-Westfalen".
 */

const SUBDIVISION_ALIASES: Record<string, string[]> = {
  'DE-BW': ['BW', 'BÜWÜ', 'Baden-Württemberg', 'BaWü', 'Ländle'],
  'DE-BY': ['BY', 'Bayern', 'Bavaria', 'Freistaat Bayern'],
  'DE-BE': ['BE', 'Berlin', 'Hauptstadt'],
  'DE-BB': ['BB', 'Brandenburg', 'Brandenburger'],
  'DE-HB': ['HB', 'Bremen', 'Freie Hansestadt Bremen'],
  'DE-HH': ['HH', 'Hamburg', 'Freie und Hansestadt Hamburg'],
  'DE-HE': ['HE', 'Hessen', 'Hesse'],
  'DE-MV': ['MV', 'Mecklenburg-Vorpommern', 'Mecklenburg', 'MeckPomm', 'Meck-Pomm'],
  'DE-NI': ['NI', 'Niedersachsen', 'Lower Saxony'],
  'DE-NW': ['NW', 'NRW', 'Nordrhein-Westfalen', 'Nordrhein Westfalen'],
  'DE-RP': ['RP', 'RLP', 'Rheinland-Pfalz', 'Rheinland Pfalz'],
  'DE-SL': ['SL', 'Saarland', 'Saar'],
  'DE-SN': ['SN', 'Sachsen', 'Saxony', 'Freistaat Sachsen'],
  'DE-ST': ['ST', 'Sachsen-Anhalt', 'Sachsen Anhalt', 'LSA'],
  'DE-SH': ['SH', 'Schleswig-Holstein', 'Schleswig Holstein'],
  'DE-TH': ['TH', 'Thüringen', 'Thuringia', 'Freistaat Thüringen'],
}

export function getSubdivisionAliases(code: string): string[] {
  return SUBDIVISION_ALIASES[code] ?? []
}

export function getAllSubdivisionAliases(): Record<string, string[]> {
  return SUBDIVISION_ALIASES
}
