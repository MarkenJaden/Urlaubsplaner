using Blazored.LocalStorage;
using Blazored.SessionStorage;
using OpenHolidaysApi.Model;
using System.Text.Json;
using Urlaubsplaner.Client.Models;

namespace Urlaubsplaner.Client.Services
{
    public class StateService
    {
        private readonly ILocalStorageService _localStorage;
        private readonly ISessionStorageService _sessionStorage;

        public StateService(ILocalStorageService localStorage, ISessionStorageService sessionStorage)
        {
            _localStorage = localStorage;
            _sessionStorage = sessionStorage;
        }

        public async Task SaveConfigAsync(PlanningConfig config)
        {
            await _localStorage.SetItemAsync("planningConfig", config);
        }

        public async Task<PlanningConfig?> LoadConfigAsync()
        {
            return await _localStorage.GetItemAsync<PlanningConfig>("planningConfig");
        }

        public async Task CacheHolidaysAsync(string key, IEnumerable<HolidayResponse> holidays)
        {
            await _sessionStorage.SetItemAsync($"cache_holidays_{key}", holidays);
        }

        public async Task<IEnumerable<HolidayResponse>?> GetCachedHolidaysAsync(string key)
        {
            return await _sessionStorage.GetItemAsync<IEnumerable<HolidayResponse>>($"cache_holidays_{key}");
        }

        public string ExportConfigToJson(PlanningConfig config)
        {
            return JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
        }

        public PlanningConfig? ImportConfigFromJson(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<PlanningConfig>(json);
            }
            catch
            {
                return null;
            }
        }
    }

}
