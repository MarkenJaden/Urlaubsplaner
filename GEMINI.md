# Urlaubsplaner - Project Context

## Project Overview

**Urlaubsplaner** is a .NET 9 Blazor Web Application designed to help users (specifically in Germany) optimize their vacation planning by leveraging public holidays and bridge days ("Brückentage").

*   **Type:** Blazor Web App (Interactive Auto Render Mode)
*   **Framework:** .NET 9
*   **Language:** C#
*   **Architecture:** Hosted Blazor WebAssembly (Client + Server)

## Architecture & Components

The solution is divided into three main projects:

1.  **`Urlaubsplaner.Client`** (Blazor WebAssembly)
    *   Contains the UI logic, Pages, and Components.
    *   **UI Library:** Uses [Radzen Blazor Components](https://blazor.radzen.com/) for the interface (Calendar, Dropdowns, etc.).
    *   **Startup:** `Program.cs` configures the WebAssembly host, Radzen services, and Localization.

2.  **`Urlaubsplaner.Server`** (ASP.NET Core)
    *   Hosts the Client application.
    *   Serves the API and handles static assets.
    *   **Configuration:** `appsettings.json` manages settings.
    *   **Startup:** `Program.cs` configures the web server, Razor components service (Interactive Server + WebAssembly), and localization.

3.  **`OpenHolidaysApi`** (Class Library)
    *   A C# wrapper/client for the [OpenHolidays API](https://openholidaysapi.org/).
    *   Contains models (e.g., `HolidayResponse`, `SubdivisionResponse`) and API logic used by the application to fetch holiday data.

## Infrastructure

*   **Docker:** The application is containerized.
    *   `Server/Dockerfile`: Defines the build image.
    *   `docker-compose.yml`: Orchestrates the service (`urlaubsplaner.server`).
*   **CI/CD:** GitHub Actions (`.github/workflows/docker-publish.yml`) handles building and publishing the Docker image to GitHub Container Registry.

## Development & Usage

### Key Commands

*   **Run Locally (Server):**
    ```bash
    dotnet run --project Server
    ```
    Access at: `https://localhost:7196` (or similar, check console output).

*   **Run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```

### Code Conventions

*   **Localization:** The app uses standard .NET localization (`IStringLocalizer`). Default culture is German (`de`).
*   **Styling:** Relies on Radzen themes (`UrlaubsplanerTheme`) and standard CSS in `wwwroot/css`.
*   **Data Models:** Models are primarily located in the `OpenHolidaysApi` project or defined within components. *Note: `Server/Models` appears currently empty.*
*   **Imports:** Global imports are managed in `_Imports.razor` files in both Client and Server projects.
*   **UI Development:** All UI elements should ideally be implemented using Radzen Blazor Components. The Radzen design-time experience ("Radzen Blazor Studio" or "Radzen IDE") can be utilized for faster development and scaffolding.

## Agent Guidelines

*   **Generated Code:** The content within the `OpenHolidaysApi/` directory is automatically generated from the API definition and **MUST NOT** be manually modified. Any necessary adaptations should be handled in the consuming projects (`Client` or `Server`) or through configuration, not by altering the generated source files.
*   **Version Control:** Never commit, push, or create new branches unless explicitly instructed by the user. Do not revert any changes without explicit instructions from the user.
*   **Build Verification:** After making any code changes, always perform a build with minimal verbosity (`dotnet build --verbosity minimal`) to identify and address any compilation errors.
*   **UI Development:** All UI elements should ideally be implemented using Radzen Blazor Components. The Radzen design-time experience ("Radzen Blazor Studio" or "Radzen IDE") can be utilized for faster development and scaffolding.

## Agent Guidelines

*   **Version Control:** Never commit, push, or create new branches unless explicitly instructed by the user.
*   **Build Verification:** After making any code changes, always perform a build with minimal verbosity (`dotnet build --verbosity minimal`) to identify and address any compilation errors.

## Key Files

*   `Urlaubsplaner.sln`: Solution file.
*   `Client/Pages/Index.razor`: Main application logic and UI.
*   `Client/Program.cs`: Client entry point.
*   `Server/Program.cs`: Server entry point.
*   `docker-compose.yml`: Container setup.