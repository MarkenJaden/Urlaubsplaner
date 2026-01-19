namespace Urlaubsplaner.Client.Models
{
    public class PlanningConfig
    {
        public string? PrimarySubdivisionCode { get; set; }
        public List<string>? CompareSubdivisionCodes { get; set; }
        public List<string>? CountryCodes { get; set; }
        public bool ShowPublicHolidays { get; set; } = true;
        public bool ShowSchoolHolidays { get; set; } = true;
        public bool ShowBridgeDays { get; set; } = true;
        public bool ShowHeatmap { get; set; } = true;
        public bool CountWeekendsAndHolidays { get; set; }
        public bool HalfDaysChristmas { get; set; } = true;
        public decimal TotalVacationDays { get; set; } = 30; // Deprecated, kept for backward compatibility if needed, or migration
        public Dictionary<int, decimal> TotalVacationDaysPerYear { get; set; } = new();
        public List<MarkingDto> SelectedSlots { get; set; } = [];
        public List<MarkingDto> Gleittage { get; set; } = [];
        public List<MarkingDto> Notes { get; set; } = [];
    }
}
