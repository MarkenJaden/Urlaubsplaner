namespace Urlaubsplaner.Client.Models
{
    public class VacationSuggestionBlock
    {
        public List<DateTime> VacationDays { get; set; } = [];
        public int FreeDaysGained { get; set; }
    }

    public class BridgeOpportunity
    {
        public List<DateTime> VacationDays { get; set; } = [];
        public int FreeDaysGained { get; set; }
        public decimal Cost { get; set; }
        public double Efficiency => Cost > 0 ? FreeDaysGained / (double)Cost : 0;
        public double Score { get; set; }
        public double DynamicScore { get; set; }
        public bool HasSatisfiedMustHave { get; set; } = false;
    }
}
