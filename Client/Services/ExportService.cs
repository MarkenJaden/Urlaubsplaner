using System.Text;
using System.Text.Json;
using Microsoft.JSInterop;

namespace Urlaubsplaner.Client.Services;

public class ExportService
{
    private readonly IJSRuntime _jsRuntime;

    public ExportService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    public async Task DownloadFile(string fileName, string mimeType, byte[] content)
    {
        await _jsRuntime.InvokeVoidAsync("downloadFileFromStream", fileName, mimeType, Convert.ToBase64String(content));
    }

    public async Task DownloadFile(string fileName, string mimeType, string content)
    {
        await DownloadFile(fileName, mimeType, Encoding.UTF8.GetBytes(content));
    }

    public async Task CopyToClipboard(string text)
    {
        await _jsRuntime.InvokeVoidAsync("navigator.clipboard.writeText", text);
    }

    public string GenerateIcs(IEnumerable<(DateTime Start, DateTime End)> slots)
    {
        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//Urlaubsplaner//DE");

        foreach (var slot in slots)
        {
            sb.AppendLine("BEGIN:VEVENT");
            sb.AppendLine($"DTSTART;VALUE=DATE:{slot.Start:yyyyMMdd}");
            // End date in iCal is exclusive, so add 1 day to the end date which is usually inclusive in our logic
            sb.AppendLine($"DTEND;VALUE=DATE:{slot.End.AddDays(1):yyyyMMdd}"); 
            sb.AppendLine("SUMMARY:Urlaub");
            sb.AppendLine("END:VEVENT");
        }

        sb.AppendLine("END:VCALENDAR");
        return sb.ToString();
    }

    public string GenerateCsv(IEnumerable<(DateTime Start, DateTime End)> slots)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Startdatum;Enddatum;Tage");
        foreach (var slot in slots)
        {
            var days = (slot.End - slot.Start).Days + 1;
            sb.AppendLine($"{slot.Start:dd.MM.yyyy};{slot.End:dd.MM.yyyy};{days}");
        }
        return sb.ToString();
    }

    public string GenerateJson(IEnumerable<(DateTime Start, DateTime End)> slots)
    {
        var data = slots.Select(s => new
        {
            StartDate = s.Start.ToString("yyyy-MM-dd"),
            EndDate = s.End.ToString("yyyy-MM-dd"),
            Days = (s.End - s.Start).Days + 1
        });
        return JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
    }

    public string GenerateSummaryText(IEnumerable<(DateTime Start, DateTime End)> slots)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Geplanter Urlaub:");
        foreach (var slot in slots)
        {
            if (slot.Start.Date == slot.End.Date)
            {
                sb.AppendLine($"- {slot.Start:dd.MM.yyyy}");
            }
            else
            {
                sb.AppendLine($"- {slot.Start:dd.MM.yyyy} bis {slot.End:dd.MM.yyyy}");
            }
        }
        return sb.ToString();
    }
}
