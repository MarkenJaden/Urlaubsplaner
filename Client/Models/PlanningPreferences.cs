using System.Collections.Generic;

namespace Urlaubsplaner.Client.Models
{
    public class PlanningPreferences
    {
        public bool PreferBridgeDays { get; set; } = true;
        public bool OptimizeForEfficiency { get; set; } // New: Maximize free days / minimize cost strictly
        public bool PreferSchoolHolidays { get; set; }
        public bool AvoidSchoolHolidays { get; set; }
        public bool AvoidAllStatesSchoolHolidays { get; set; }
        public bool DistributeEvenly { get; set; } = true;

        public NoteHandlingMode NoteHandling { get; set; } = NoteHandlingMode.Avoid;

        // How strongly notes affect suggestions.
        // 1.0 = no effect, >1 prefers matching notes, <1 avoids matching notes.
        public double NoteOverlapAvoidMultiplier { get; set; } = 0.20;
        public double NoteOverlapPreferMultiplier { get; set; } = 1.35;

        public int MinDaysPerBlock { get; set; } = 1;
        public int? MaxDaysPerBlock { get; set; }

        public List<PeriodPreference> PeriodPreferences { get; set; } = [];
    }

    public class PeriodPreference
    {
        public PreferenceType Type { get; set; }
        public List<int> Months { get; set; } = [];
        public int MinDuration { get; set; }
    }

    public enum PreferenceType
    {
        MustHave,
        NiceToHave
    }

    public enum NoteHandlingMode
    {
        Avoid,
        Prefer
    }
}
