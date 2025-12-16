namespace Urlaubsplaner.Client.Models
{
    public class MarkingDto
    {
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Type { get; set; }
    }
}
