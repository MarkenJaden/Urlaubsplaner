namespace Urlaubsplaner.Client.Models
{
    public enum MarkingType
    {
        PublicHoliday,
        PublicHolidayCompare,
        SchoolHoliday,
        SchoolHolidayCompare,
        Selected,
        BridgeDay,
        Gleittag,
        Note
    }

    public class Marking
    {
        public DateTime Start { get; init; }
        public DateTime End { get; init; }
        public string Name { get; init; } = string.Empty;
        public string SubdivisionName { get; set; } = string.Empty;
        public MarkingType Type { get; set; }
    }
}
