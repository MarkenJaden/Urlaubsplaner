namespace Urlaubsplaner.Client.Models
{
    public class Country
    {
        public string Name { get; init; } = string.Empty;
        public string IsoCode { get; init; } = string.Empty;
        public string SearchKeywords { get; init; } = string.Empty;
    }

    public class Subdivision
    {
        public string Name { get; init; } = string.Empty;
        public string Category { get; init; } = string.Empty;
        public string Code { get; init; } = string.Empty;
        public string IsoCode { get; init; } = string.Empty;
        public string SearchKeywords { get; init; } = string.Empty;
    }
}
