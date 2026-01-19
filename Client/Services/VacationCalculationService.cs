// For HolidayResponse properties
using Urlaubsplaner.Client.Models;

namespace Urlaubsplaner.Client.Services
{
    public class VacationCalculationService(HolidayService holidayService)
    {
        public (decimal plannedDays, int gleittageCount) CalculatePlannedDays(
            IEnumerable<Marking> selectedSlots, 
            IEnumerable<Marking> gleittage,
            IEnumerable<Marking> allMarkings, // All holidays to check against
            bool halfDaysChristmas)
        {
            decimal plannedDays = 0m;
            int gleittageCount = gleittage.Count();

            var primaryPublicHolidays = allMarkings
                .Where(m => m.Type == MarkingType.PublicHoliday)
                .SelectMany(m => Enumerable.Range(0, (m.End.Date - m.Start.Date).Days + 1).Select(d => m.Start.Date.AddDays(d)))
                .ToHashSet();

            foreach (var slot in selectedSlots)
            {
                var date = slot.Start.Date;
                bool isWeekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
                bool isHoliday = primaryPublicHolidays.Contains(date);

                if (!isWeekend && !isHoliday)
                {
                    decimal cost = (halfDaysChristmas && IsHalfDayChristmas(date)) ? 0.5m : 1.0m;
                    plannedDays += cost;
                }
            }

            return (plannedDays, gleittageCount);
        }

        public int CalculateRemainingWorkDays(
            int year, 
            IEnumerable<Marking> selectedSlots, 
            IEnumerable<Marking> gleittage, 
            IEnumerable<Marking> allMarkings, // All holidays to check against
            bool countWeekendsAndHolidays)
        {
            int remainingWorkDays = 0;

            var startOfYear = new DateTime(year, 1, 1);
            var endOfYear = new DateTime(year, 12, 31);
            var startCalc = DateTime.Today > startOfYear ? DateTime.Today : startOfYear;
            if (startCalc.Year > year) { return 0; }

            var primaryPublicHolidays = allMarkings
                .Where(m => m.Type == MarkingType.PublicHoliday)
                .SelectMany(m => Enumerable.Range(0, (m.End.Date - m.Start.Date).Days + 1).Select(d => m.Start.Date.AddDays(d)))
                .ToHashSet();

            for (var d = startCalc; d <= endOfYear; d = d.AddDays(1))
            {
                bool isWeekend = d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

                if (!countWeekendsAndHolidays)
                {
                    if (isWeekend) continue;
                    if (primaryPublicHolidays.Contains(d)) continue;
                }

                if (selectedSlots.Any(s => s.Start.Date == d)) continue;
                if (gleittage.Any(g => g.Start.Date == d)) continue;

                remainingWorkDays++;
            }
            return remainingWorkDays;
        }

        public List<Marking> CalculateBridgeDays(
            DateTime start, 
            DateTime end, 
            IEnumerable<Marking> allMarkings)
        {
            var bridgeDaysToAdd = new List<Marking>();

            var primaryHolidays = allMarkings
                .Where(m => m.Type == MarkingType.PublicHoliday)
                .SelectMany(m => Enumerable.Range(0, (m.End.Date - m.Start.Date).Days + 1).Select(d => m.Start.Date.AddDays(d)))
                .ToHashSet();

            var nonWorkDays = new HashSet<DateTime>(primaryHolidays);
            for (var d = start; d <= end; d = d.AddDays(1))
            {
                if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) nonWorkDays.Add(d);
            }

            for (var d = start; d <= end; d = d.AddDays(1))
            {
                if (nonWorkDays.Contains(d)) continue;

                var prev = d.AddDays(-1);
                int gapBefore = 0;
                while (!nonWorkDays.Contains(prev) && prev >= start) { prev = prev.AddDays(-1); gapBefore++; }

                var next = d.AddDays(1);
                int gapAfter = 0;
                while (!nonWorkDays.Contains(next) && next <= end) { next = next.AddDays(1); gapAfter++; }

                if (gapBefore == 0)
                {
                    int blockSize = 1 + gapAfter;
                    if (blockSize <= 2)
                    {
                        bool touchesHoliday = primaryHolidays.Contains(prev) || primaryHolidays.Contains(next);

                        if (touchesHoliday)
                        {
                            bridgeDaysToAdd.Add(new Marking { Start = d, End = d, Name = "Brückentag", Type = MarkingType.BridgeDay });
                            if (blockSize == 2)
                                bridgeDaysToAdd.Add(new Marking { Start = d.AddDays(1), End = d.AddDays(1), Name = "Brückentag", Type = MarkingType.BridgeDay });
                        }
                    }
                }
            }
            return bridgeDaysToAdd;
        }

        public async Task<List<VacationSuggestionBlock>> SuggestPerfectVacation(
            PlanningPreferences prefs,
            Subdivision primarySubdivision,
            decimal totalVacationDays,
            decimal plannedDays,
            bool halfDaysChristmas,
            bool overwriteExisting,
            bool planFromToday,
            int year,
            List<Marking> currentSelectedSlots,
            List<Marking> notes)
        {
            decimal vacationDaysToPlan = overwriteExisting ? totalVacationDays : totalVacationDays - plannedDays;
            if (vacationDaysToPlan <= 0 && !overwriteExisting)
            {
                return []; // No days left to plan
            }

            var startDate = planFromToday ? DateTime.Today : new DateTime(year, 1, 1);
            var endDate = new DateTime(year, 12, 31);

            var publicHolidays = await holidayService.FetchHolidaysCached("DE", startDate, endDate, primarySubdivision.Code, false);
            var phDates = publicHolidays
                .Where(h => h.StartDate.HasValue && h.EndDate.HasValue)
                .SelectMany(h => Enumerable.Range(0, (h.EndDate.Value.Date - h.StartDate.Value.Date).Days + 1).Select(offset => h.StartDate.Value.Date.AddDays(offset)))
                .ToHashSet();

            var noteDates = notes
                .Where(n => n.Type == MarkingType.Note)
                .Select(n => n.Start.Date)
                .ToHashSet();

            var shDates = new HashSet<DateTime>();
            if (prefs.PreferSchoolHolidays || prefs.AvoidSchoolHolidays)
            {
                var schoolHolidays = await holidayService.FetchHolidaysCached("DE", startDate, endDate, primarySubdivision.Code, true);
                shDates = schoolHolidays
                    .Where(h => h.StartDate.HasValue && h.EndDate.HasValue)
                    .SelectMany(h => Enumerable.Range(0, (h.EndDate.Value.Date - h.StartDate.Value.Date).Days + 1).Select(offset => h.StartDate.Value.Date.AddDays(offset)))
                    .ToHashSet();
            }

            var datesForAvoidance = new HashSet<DateTime>();
            if (prefs.AvoidSchoolHolidays && prefs.AvoidAllStatesSchoolHolidays)
            {
                var allStatesSchoolHolidays = await holidayService.FetchHolidaysCached("DE", startDate, endDate, null, true);
                datesForAvoidance = allStatesSchoolHolidays
                    .Where(sh => sh.StartDate.HasValue && sh.EndDate.HasValue)
                    .SelectMany(h => Enumerable.Range(0, (h.EndDate.Value.Date - h.StartDate.Value.Date).Days + 1).Select(offset => h.StartDate.Value.Date.AddDays(offset)))
                    .ToHashSet();
            }
            else
            {
                datesForAvoidance = shDates; // If not avoiding all states, just avoid selected state's school holidays
            }


            var nonWorkDays = new HashSet<DateTime>();
            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || phDates.Contains(date))
                {
                    nonWorkDays.Add(date);
                }
            }

            var opportunities = new List<BridgeOpportunity>();
            var currentDate = startDate;
            while (currentDate <= endDate)
            {
                if (!nonWorkDays.Contains(currentDate))
                {
                    var periodStart = currentDate;
                    var beforePeriod = periodStart.AddDays(-1);

                    if (nonWorkDays.Contains(beforePeriod) || periodStart == startDate)
                    {
                        var workDays = new List<DateTime>();
                        var tempDate = periodStart;
                        while (!nonWorkDays.Contains(tempDate) && tempDate <= endDate)
                        {
                            workDays.Add(tempDate);
                            tempDate = tempDate.AddDays(1);
                        }

                        var afterPeriod = tempDate;
                        if (nonWorkDays.Contains(afterPeriod) || afterPeriod > endDate)
                        {
                            var freeDaysBefore = 0;
                            var checkDateBefore = beforePeriod;
                            while (nonWorkDays.Contains(checkDateBefore) && checkDateBefore >= startDate)
                            {
                                freeDaysBefore++;
                                checkDateBefore = checkDateBefore.AddDays(-1);
                            }

                            var freeDaysAfter = 0;
                            var checkDateAfter = afterPeriod;
                            while (nonWorkDays.Contains(checkDateAfter) && checkDateAfter <= endDate)
                            {
                                freeDaysAfter++;
                                checkDateAfter = checkDateAfter.AddDays(1);
                            }

                            decimal cost = workDays.Sum(day => (halfDaysChristmas && IsHalfDayChristmas(day)) ? 0.5m : 1.0m);
                            
                            double score = 0;
                            
                            double efficiency = cost > 0 ? (workDays.Count + freeDaysBefore + freeDaysAfter) / (double)cost : 0;
                            score = efficiency * 10;

                            if (workDays.Count < prefs.MinDaysPerBlock) score = 0;
                            if (prefs.MaxDaysPerBlock.HasValue && workDays.Count > prefs.MaxDaysPerBlock.Value) score = 0;

                                if (score > 0)
                                {
                                    bool overlapsNotes = noteDates.Count > 0 && workDays.Any(d => noteDates.Contains(d));
                                    if (overlapsNotes)
                                    {
                                        double multiplier = prefs.NoteHandling switch
                                        {
                                            NoteHandlingMode.Prefer => prefs.NoteOverlapPreferMultiplier,
                                            _ => prefs.NoteOverlapAvoidMultiplier
                                        };

                                        // Guard against accidental zero/negative values.
                                        multiplier = Math.Clamp(multiplier, 0.0, 100.0);
                                        score *= multiplier;
                                    }

                                    if (prefs.PreferSchoolHolidays)
                                    {
                                        bool overlaps = workDays.Any(d => shDates.Contains(d));
                                        if (overlaps) score *= 1.5;
                                    }

                                    if (prefs.AvoidSchoolHolidays)
                                    {
                                        bool overlaps = workDays.Any(d => datesForAvoidance.Contains(d));
                                        if (overlaps) score *= 0.5;
                                    }
                                }

                            bool currentBlockSatisfiesMustHave = false;
                            foreach (var periodPref in prefs.PeriodPreferences)
                            {
                                bool monthsMatch = workDays.Any(d => periodPref.Months.Contains(d.Month));
                                int blockDuration = workDays.Count;

                                if (monthsMatch && blockDuration >= periodPref.MinDuration)
                                {
                                    if (periodPref.Type == PreferenceType.MustHave)
                                    {
                                        score += 10000;
                                        currentBlockSatisfiesMustHave = true;
                                    }
                                    else if (periodPref.Type == PreferenceType.NiceToHave)
                                    {
                                        score *= 1.5;
                                    }
                                }
                            }
                            
                            if (prefs.PreferBridgeDays)
                            {
                                if (efficiency >= 2.0) score *= 1.2;
                            }

                            if (score > 0)
                            {
                                opportunities.Add(new BridgeOpportunity
                                {
                                    VacationDays = workDays,
                                    FreeDaysGained = workDays.Count + freeDaysBefore + freeDaysAfter,
                                    Cost = cost,
                                    Score = score,
                                    HasSatisfiedMustHave = currentBlockSatisfiesMustHave
                                });
                            }
                        }
                        currentDate = tempDate;
                        continue;
                    }
                }
                currentDate = currentDate.AddDays(1);
            }

            var sortedOpportunities = opportunities
                .Where(o => o.VacationDays.Any())
                .OrderByDescending(o => o.Score)
                .ToList();

            if (prefs.PeriodPreferences.Any(p => p.Type == PreferenceType.MustHave))
            {
                sortedOpportunities = sortedOpportunities.Where(o => o.HasSatisfiedMustHave).ToList();
            }

            if (!overwriteExisting)
            {
                var selectedDates = currentSelectedSlots.Select(s => s.Start.Date).ToHashSet();
                sortedOpportunities.RemoveAll(op => op.VacationDays.Any(d => selectedDates.Contains(d)));
            }

            var selectedOpportunities = new List<BridgeOpportunity>();
            decimal remainingBudget = vacationDaysToPlan;

            var candidates = sortedOpportunities.ToList();

            bool hasLongVacation = false;
            bool hasSummerVacation = false;

            while (candidates.Count > 0 && remainingBudget > 0)
            {
                // Dynamic Re-Scoring
                foreach (var cand in candidates)
                {
                    cand.DynamicScore = cand.Score;

                    if (!prefs.OptimizeForEfficiency)
                    {
                        if (!hasLongVacation && (!prefs.MaxDaysPerBlock.HasValue || prefs.MaxDaysPerBlock.Value >= 10))
                        {
                            if (cand.VacationDays.Count >= 8) 
                            {
                                cand.DynamicScore *= 1.35;
                            }
                        }

                        bool hasMustHaveConstraints = prefs.PeriodPreferences.Any(p => p.Type == PreferenceType.MustHave);
                        if (!hasSummerVacation && !hasMustHaveConstraints)
                        {
                            var midPoint = cand.VacationDays.Any() ? cand.VacationDays[cand.VacationDays.Count / 2] : DateTime.MinValue;
                            if (midPoint.Month is >= 6 and <= 8) 
                            {
                                cand.DynamicScore *= 1.15;
                            }
                        }
                    }

                    if (prefs.DistributeEvenly && selectedOpportunities.Any())
                    {
                        var candDate = cand.VacationDays.First();
                        var minDistance = selectedOpportunities.Min(s => Math.Abs((s.VacationDays.First() - candDate).Days));

                        if (minDistance < 60)
                        {
                            cand.DynamicScore *= 0.2;
                        }
                        else if (minDistance < 90)
                        {
                            cand.DynamicScore *= 0.7;
                        }
                    }
                }

                candidates = candidates.OrderByDescending(o => o.DynamicScore).ToList();
                
                if (!candidates.Any()) break;

                var bestOp = candidates.First();
                candidates.RemoveAt(0);

                if (bestOp.Cost <= remainingBudget)
                {
                    bool overlaps = selectedOpportunities.Any(s => s.VacationDays.Intersect(bestOp.VacationDays).Any());
                    
                    if (!overlaps)
                    {
                        selectedOpportunities.Add(bestOp);
                        remainingBudget -= bestOp.Cost;

                        if (bestOp.VacationDays.Count >= 8) hasLongVacation = true;
                        
                        var mid = bestOp.VacationDays.Any() ? bestOp.VacationDays[bestOp.VacationDays.Count / 2] : DateTime.MinValue;
                        if (mid.Month is >= 6 and <= 8) hasSummerVacation = true;
                    }
                }
            }
            
            return selectedOpportunities
                .OrderBy(op => op.VacationDays.First())
                .Select(op => new VacationSuggestionBlock
                {
                    VacationDays = op.VacationDays,
                    FreeDaysGained = op.FreeDaysGained
                }).ToList();
        }

        private static bool IsHalfDayChristmas(DateTime date) => date.Month == 12 && (date.Day == 24 || date.Day == 31);
    }
}