using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Radzen;
using Microsoft.JSInterop;
using System.Globalization;
using Blazored.LocalStorage;
using Blazored.SessionStorage;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.Services.AddRadzenComponents();
builder.Services.AddRadzenCookieThemeService(options =>
{
    options.Name = "UrlaubsplanerTheme";
    options.Duration = TimeSpan.FromDays(365);
});
builder.Services.AddTransient(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<Urlaubsplaner.Client.Services.ExportService>();
builder.Services.AddLocalization();
builder.Services.AddBlazoredLocalStorage();
builder.Services.AddBlazoredSessionStorage();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.StateService>();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.HolidayService>();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.VacationCalculationService>();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.OpenHolidaysBootstrapState>();
var host = builder.Build();
var jsRuntime = host.Services.GetRequiredService<IJSRuntime>();
var culture = await jsRuntime.InvokeAsync<string>("Radzen.getCulture");
if (!string.IsNullOrEmpty(culture))
{
    CultureInfo.DefaultThreadCurrentCulture = new CultureInfo(culture);
    CultureInfo.DefaultThreadCurrentUICulture = new CultureInfo(culture);
}

await host.RunAsync();