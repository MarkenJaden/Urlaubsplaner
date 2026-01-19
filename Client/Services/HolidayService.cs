using OpenHolidaysApi.Api;
using OpenHolidaysApi.Model;
using Urlaubsplaner.Client.Models;
using Urlaubsplaner.Client.Helpers;

namespace Urlaubsplaner.Client.Services
{
    public class HolidayService
    {
        private readonly StateService _stateService;
        private readonly HolidaysApi _holidaysApi;
        private readonly RegionalApi _regionalApi;

        public HolidayService(StateService stateService)
        {
            _stateService = stateService;
            _holidaysApi = new HolidaysApi();
            _regionalApi = new RegionalApi();
        }

        public async Task<List<Country>> LoadCountriesAsync()
        {
            try
            {
                var allCountriesApi = await _regionalApi.CountriesGetAsync("DE");
                return allCountriesApi.Select(country =>
                {
                    var searchTerms = new List<string> { country.Name.First().Text, country.IsoCode };
                    if (GeoConstants.CountryMappings.TryGetValue(country.IsoCode, out var aliases)) searchTerms.AddRange(aliases);
                    return new Country
                    {
                        Name = country.Name.First().Text,
                        IsoCode = country.IsoCode,
                        SearchKeywords = string.Join(" ", searchTerms).ToLower()
                    };
                }).Where(c => c.IsoCode != "DE").ToList();
            }
            catch
            {
                return [];
            }
        }

        public async Task<List<Subdivision>> LoadSubdivisionsAsync()
        {
            try
            {
                var subdivisionsApi = await _regionalApi.SubdivisionsGetAsync("DE", "DE");
                return subdivisionsApi.Select(sub =>
                {
                    var codePart = sub.Code.Split('-').LastOrDefault();
                    var searchTerms = new List<string> { sub.Name.First().Text, sub.Code, codePart ?? "" };
                    if (codePart != null && GeoConstants.SubdivisionAbbreviations.TryGetValue(codePart, out var aliases)) searchTerms.AddRange(aliases);
                    return new Subdivision
                    {
                        Name = sub.Name.First().Text,
                        Category = sub.Category.First().Text,
                        Code = sub.Code,
                        IsoCode = sub.IsoCode,
                        SearchKeywords = string.Join(" ", searchTerms).ToLower()
                    };
                }).ToList();
            }
            catch
            {
                return [];
            }
        }

        public async Task<List<HolidayResponse>> FetchHolidaysCached(string isoCode, DateTime start, DateTime end, string? subdivisionCode, bool isSchool)
        {
            string key = $"{isoCode}_{start:yyyy-MM-dd}_{end:yyyy-MM-dd}_{subdivisionCode}_{isSchool}";
            var cached = await _stateService.GetCachedHolidaysAsync(key);
            if (cached != null) return cached.ToList();

            try
            {
                List<HolidayResponse> result;
                if (isSchool)
                {
                    result = await _holidaysApi.SchoolHolidaysGetAsync(isoCode, start, end, "DE", subdivisionCode);
                }
                else
                {
                    result = await _holidaysApi.PublicHolidaysGetAsync(isoCode, start, end, "DE", subdivisionCode);
                }

                await _stateService.CacheHolidaysAsync(key, result);
                return result;
            }
            catch
            {
                return [];
            }
        }
    }
}
