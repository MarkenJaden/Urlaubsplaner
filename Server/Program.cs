using Blazored.LocalStorage;
using Blazored.SessionStorage;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Radzen;
using Urlaubsplaner.Server.Components;

var builder = WebApplication.CreateBuilder(args);
// Add services to the container.
builder.Services.AddRazorComponents().AddInteractiveServerComponents().AddHubOptions(options => options.MaximumReceiveMessageSize = 10 * 1024 * 1024).AddInteractiveWebAssemblyComponents();
builder.Services.AddControllers();
builder.Services.AddRadzenComponents();
builder.Services.AddRadzenCookieThemeService(options =>
{
    options.Name = "UrlaubsplanerTheme";
    options.Duration = TimeSpan.FromDays(365);
});
builder.Services.AddHttpClient();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.ExportService>();
builder.Services.AddLocalization();
builder.Services.AddBlazoredLocalStorage();
builder.Services.AddBlazoredSessionStorage();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.StateService>();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.HolidayService>();
builder.Services.AddScoped<Urlaubsplaner.Client.Services.VacationCalculationService>();

var keysDirectory = builder.Environment.IsDevelopment()
    ? new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, ".keys"))
    : new DirectoryInfo("/var/keys");

builder.Services.AddDataProtection().PersistKeysToFileSystem(keysDirectory).SetApplicationName("Urlaubsplaner");

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    options.KnownProxies.Clear();
    options.KnownNetworks.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

// app.UseHttpsRedirection();
app.MapControllers();
app.UseRequestLocalization(options => options.AddSupportedCultures("de").AddSupportedUICultures("de").SetDefaultCulture("de"));
app.UseStaticFiles();
app.UseAntiforgery();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode().AddInteractiveWebAssemblyRenderMode().AddAdditionalAssemblies(typeof(Urlaubsplaner.Client._Imports).Assembly);
app.Run();