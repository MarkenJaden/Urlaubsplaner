# AGENTS.md (Urlaubsplaner)

This repo is a .NET 9 solution with:
- `Server/Urlaubsplaner.Server.csproj`: ASP.NET Core + Razor Components (interactive server + WASM)
- `Client/Urlaubsplaner.Client.csproj`: Blazor WebAssembly
- `OpenHolidaysApi/OpenHolidaysApi.csproj`: generated OpenHolidays API client library

Use this document as the “house rules” for agentic changes.

## Quick Orientation
- Prefer the solution entrypoint: `Urlaubsplaner.sln`.
- Most app behavior lives in `Client/` (Blazor UI, services, models).
- HTTP endpoints live in `Server/Controllers/`.
- `OpenHolidaysApi/` contains generated/third-party code; avoid style refactors there.

## Build / Run

### Prereqs
- Install **.NET 9 SDK**.
- Optional: Docker Desktop (for compose).

### Restore
- Restore solution: `dotnet restore "./Urlaubsplaner.sln"`
- Restore only server: `dotnet restore "./Server/Urlaubsplaner.Server.csproj"`

### Build
- Build solution (Debug): `dotnet build "./Urlaubsplaner.sln" -c Debug`
- Build solution (Release): `dotnet build "./Urlaubsplaner.sln" -c Release`
- Build server only: `dotnet build "./Server/Urlaubsplaner.Server.csproj" -c Debug`
- Build client only: `dotnet build "./Client/Urlaubsplaner.Client.csproj" -c Debug`

### Run (local)
- Run server (recommended):
  - From repo root: `dotnet run --project "./Server/Urlaubsplaner.Server.csproj"`
  - Or inside `Server/`: `dotnet run`
- The server hosts the WASM client; dev URLs are printed in console.

### Run (Docker)
- Build + run via compose: `docker-compose up --build -d`
- Stop: `docker-compose down`

## Lint / Formatting

This repo doesn’t currently include a dedicated linter config (no `.editorconfig` at root).
Use `dotnet format` for what it can enforce.

### dotnet-format
- Install tool (if not available): `dotnet tool restore`
  - Tools are pinned in `Server/.config/dotnet-tools.json` (currently includes `dotnet-ef`).
- Format (safe default): `dotnet format "./Urlaubsplaner.sln"`
- Verify formatting (CI-style): `dotnet format "./Urlaubsplaner.sln" --verify-no-changes`

### Build-time warnings
- Try to keep the warning budget stable; the projects suppress several warnings via `<NoWarn>`.
- Preferred: fix warnings when touching related code.

## Tests

There are currently **no test projects** checked into this solution.
If you add tests, align with the existing stack:
- Prefer xUnit for new unit tests.
- Put tests in a new `*.Tests` project (e.g., `Urlaubsplaner.Client.Tests`) and add it to the solution.

### Standard test commands (once tests exist)
- Run all tests: `dotnet test "./Urlaubsplaner.sln" -c Debug`
- Run tests for one project: `dotnet test "./path/to/Project.Tests.csproj"`

### Run a single test (xUnit / MSTest / NUnit)
`dotnet test` supports filtering via `--filter`.

Examples:
- By fully qualified name:
  - `dotnet test "./path/to/Project.Tests.csproj" --filter "FullyQualifiedName~Namespace.TypeName.TestName"`
- By class name:
  - `dotnet test "./path/to/Project.Tests.csproj" --filter "FullyQualifiedName~TypeName"`
- By trait/category (xUnit):
  - `dotnet test "./path/to/Project.Tests.csproj" --filter "Category=Fast"`

Tip: `~` means “contains” and is usually easiest.

## Repo Conventions (C# / Blazor)

### Language / target
- Target framework is **`net9.0`** for Server/Client/OpenHolidaysApi.
- `ImplicitUsings` is enabled; keep using directives minimal.
- `OpenHolidaysApi` has `Nullable` enabled; strive to keep nullable warnings clean.

### Imports / usings
- Prefer file-scoped `using` statements at top (current code uses both).
- Keep `using` lists small and sorted:
  - System namespaces first (`System.*`)
  - Then third-party (`Radzen`, `Blazored.*`, etc.)
  - Then project namespaces (`Urlaubsplaner.*`)
- Avoid unused usings; remove them when editing files.
- Prefer explicit namespace imports over `global using` additions unless broadly needed.

### Namespaces
- Follow folder-to-namespace mapping:
  - `Client/Services/*` → `Urlaubsplaner.Client.Services`
  - `Client/Models/*` → `Urlaubsplaner.Client.Models`
  - `Server/Controllers/*` → `Urlaubsplaner.Server.Controllers`

### Formatting
- Use the existing style in each file; don’t reformat unrelated lines.
- Prefer:
  - 4-space indentation
  - Braces on new lines for types/methods (as used in most files)
  - Expression-bodied members only when they improve readability
  - Pattern matching (`is DayOfWeek.Saturday or DayOfWeek.Sunday`) is already used
- Strings: use `$"..."` interpolations when clearer than `string.Format`.

### Types & nullability
- Prefer non-nullable reference types for new code; add `?` only when a value is truly optional.
- Avoid `null!` except for framework-bound properties where unavoidable.
- Prefer `IReadOnlyList<T>` / `IReadOnlyCollection<T>` for inputs that shouldn’t be mutated.
- Prefer `record`/`record struct` for immutable DTO-like models when appropriate.

### Naming
- Public members: `PascalCase`.
- Private fields: `_camelCase` (already used, e.g. `_holidayService`).
- Locals/parameters: `camelCase`.
- Async methods: suffix with `Async`.
- Boolean flags: prefix with `is/has/can/should`.

### Error handling
- Web endpoints (`Server/Controllers`):
  - Return meaningful HTTP status codes (`BadRequest`, `NotFound`, `Problem`, etc.).
  - Prefer `ProblemDetails` for unexpected failures.
  - Validate input early; avoid deep nesting.
- Client services:
  - Catch only when you can add context or recover.
  - Prefer surfacing failures to UI via a dedicated state/notification mechanism (Radzen `NotificationService` is available).
- Avoid swallowing exceptions (`catch {}`) unless intentionally best-effort with a comment.

### Performance & allocations
- Avoid repeated `Any(...)` over large enumerables inside loops; precompute sets when needed.
- Prefer `HashSet<DateTime>` / lookups for repeated membership checks (already used).
- Be mindful of time zones; most code uses `.Date` and local dates.

### Blazor/Razor patterns
- Keep UI logic in `.razor` minimal; push logic into services/models when reusable.
- Prefer `@code { }` blocks with clear separation between:
  - parameters (`[Parameter]`)
  - injected services (`[Inject]`)
  - event handlers
  - computed properties
- Avoid heavy synchronous work on the UI thread; use `async` and show progress.

## Generated / External Code
- `OpenHolidaysApi/` appears generated (Swagger-like). Avoid large refactors there.
- When changing generated code is necessary, prefer regenerating upstream; otherwise keep edits minimal and well-scoped.

## Dependencies & safety
- Don’t add new NuGet dependencies without a clear need.
- Keep versions consistent with existing packages (e.g., `Radzen.Blazor`, `Blazored.*`).

## Cursor/Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` were found in this repo.

## Suggested workflow for agents
1. Identify the owning project (`Client` vs `Server`).
2. Build impacted project: `dotnet build ...`.
3. Run formatting: `dotnet format ...` (or at least keep diffs minimal).
4. If tests exist, run targeted `dotnet test --filter ...`.
