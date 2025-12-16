namespace Urlaubsplaner.Client.Helpers
{
    public static class GeoConstants
    {
        public static readonly Dictionary<string, string[]> SubdivisionAbbreviations = new()
        {
            { "BW", ["Baden-Württemberg", "Baden Wuerttemberg"] },
            { "BY", ["Bayern", "Bavaria"] },
            { "BE", ["Berlin"] },
            { "BB", ["Brandenburg"] },
            { "HB", ["Bremen", "Hansestadt Bremen"] },
            { "HH", ["Hamburg", "Hansestadt Hamburg"] },
            { "HE", ["Hessen", "Hesse"] },
            { "MV", ["Mecklenburg-Vorpommern", "MeckPomm", "MVP"] },
            { "NI", ["Niedersachsen", "Lower Saxony"] },
            { "NW", ["Nordrhein-Westfalen", "NRW", "North Rhine-Westphalia"] },
            { "RP", ["Rheinland-Pfalz", "RLP", "Rhineland-Palatinate"] },
            { "SL", ["Saarland"] },
            { "SN", ["Sachsen", "Saxony"] },
            { "ST", ["Sachsen-Anhalt", "Saxony-Anhalt"] },
            { "SH", ["Schleswig-Holstein", "S-H"] },
            { "TH", ["Thüringen", "Thuringia"] }
        };

        public static readonly Dictionary<string, string[]> CountryMappings = new()
        {
            { "AT", ["Österreich", "Austria"] },
            { "CH", ["Schweiz", "Switzerland", "Confoederatio Helvetica"] },
            { "FR", ["Frankreich", "France"] },
            { "PL", ["Polen", "Poland"] },
            { "CZ", ["Tschechien", "Czechia", "Czech Republic"] },
            { "DK", ["Dänemark", "Denmark"] },
            { "NL", ["Niederlande", "Netherlands", "Holland"] },
            { "BE", ["Belgien", "Belgium"] },
            { "LU", ["Luxemburg", "Luxembourg"] }
        };
    }
}
