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

    public sealed class ExportItem
    {
        public required DateTime Start { get; init; }
        public required DateTime End { get; init; }
        public required string Title { get; init; }
        public required string Category { get; init; }
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

    public string GenerateIcs(IReadOnlyList<ExportItem> items)
    {
        var merged = MergeContiguous(items);

        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//Urlaubsplaner//DE");

        foreach (var item in merged)
        {
            sb.AppendLine("BEGIN:VEVENT");
            sb.AppendLine($"DTSTART;VALUE=DATE:{item.Start:yyyyMMdd}");
            // DTEND in iCal is exclusive; for an all-day single-day event use Start+1 day.
            var endExclusive = (item.End.Date <= item.Start.Date ? item.Start.Date.AddDays(1) : item.End.Date.AddDays(1));
            sb.AppendLine($"DTEND;VALUE=DATE:{endExclusive:yyyyMMdd}");
            sb.AppendLine($"SUMMARY:{EscapeIcsText(item.Title)}");
            sb.AppendLine($"CATEGORIES:{EscapeIcsText(item.Category)}");
            sb.AppendLine("END:VEVENT");
        }

        sb.AppendLine("END:VCALENDAR");
        return sb.ToString();
    }

    public string GenerateCsv(IReadOnlyList<ExportItem> items)
    {
        var merged = MergeContiguous(items);

        var sb = new StringBuilder();
        sb.AppendLine("Kategorie;Titel;Startdatum;Enddatum;Tage");
        foreach (var item in merged)
        {
            var days = (item.End - item.Start).Days + 1;
            sb.AppendLine($"{item.Category};{item.Title};{item.Start:dd.MM.yyyy};{item.End:dd.MM.yyyy};{days}");
        }
        return sb.ToString();
    }

    public string GenerateJson(IReadOnlyList<ExportItem> items)
    {
        var merged = MergeContiguous(items);

        var data = merged.Select(s => new
        {
            Category = s.Category,
            Title = s.Title,
            StartDate = s.Start.ToString("yyyy-MM-dd"),
            EndDate = s.End.ToString("yyyy-MM-dd"),
            Days = (s.End - s.Start).Days + 1
        });
        return JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
    }

    public string GenerateSummaryText(IReadOnlyList<ExportItem> items)
    {
        var merged = MergeContiguous(items);

        var sb = new StringBuilder();
        foreach (var grp in merged.GroupBy(x => x.Category).OrderBy(x => x.Key))
        {
            sb.AppendLine($"{grp.Key}:");
            foreach (var item in grp)
            {
                if (item.Start.Date == item.End.Date)
                {
                    sb.AppendLine($"- {item.Start:dd.MM.yyyy}: {item.Title}");
                }
                else
                {
                    sb.AppendLine($"- {item.Start:dd.MM.yyyy} bis {item.End:dd.MM.yyyy}: {item.Title}");
                }
            }
            sb.AppendLine();
        }
        return sb.ToString().TrimEnd();
    }

    private static List<ExportItem> MergeContiguous(IReadOnlyList<ExportItem> items)
    {
        var ordered = items.OrderBy(x => x.Category).ThenBy(x => x.Title).ThenBy(x => x.Start).ToList();
        if (ordered.Count == 0)
        {
            return [];
        }

        var result = new List<ExportItem>();
        ExportItem current = ordered[0];

        for (int i = 1; i < ordered.Count; i++)
        {
            var next = ordered[i];

            // Same "kind" means same Category.
            // Notes should only merge when the description matches; for vacation/gleittag we merge by Category only.
            bool sameKind = next.Category == current.Category;
            if (sameKind && string.Equals(current.Category, "Notiz", StringComparison.OrdinalIgnoreCase))
            {
                sameKind = next.Title == current.Title;
            }
            bool isNextDay = next.Start.Date == current.End.Date.AddDays(1);

            if (sameKind && isNextDay)
            {
                current = new ExportItem
                {
                    Start = current.Start,
                    End = next.End,
                    Title = current.Title,
                    Category = current.Category
                };
            }
            else
            {
                result.Add(current);
                current = next;
            }
        }

        result.Add(current);
        return result;
    }

    private static string EscapeIcsText(string value)
    {
        return value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");
    }
}
