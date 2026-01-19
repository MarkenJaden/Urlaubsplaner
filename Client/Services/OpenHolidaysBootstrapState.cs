using Microsoft.AspNetCore.Components;
using Urlaubsplaner.Client.Models;

namespace Urlaubsplaner.Client.Services;

public class OpenHolidaysBootstrapState
{
    [PersistentState]
    public List<Subdivision>? Subdivisions { get; set; }

    [PersistentState]
    public List<Country>? Countries { get; set; }

    [PersistentState]
    public DateTimeOffset? LoadedAt { get; set; }
}
