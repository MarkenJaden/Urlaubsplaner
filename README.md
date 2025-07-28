# Urlaubsplaner - The Smart Vacation Planner

![Urlaubsplaner Logo](Server/wwwroot/images/logo.png)

**Maximize your time off! This intelligent vacation planner helps you find the optimal vacation periods by cleverly utilizing public holidays and bridge days ("Brückentage").**

This application is designed for users in Germany, providing a powerful tool to visualize and plan vacations for the entire year. It fetches data for public holidays and school holidays, calculates the best opportunities to use your vacation days, and presents everything in an intuitive, interactive calendar.

*(Note: A live demo or a screenshot of the application would be great here!)*
<!-- ![Urlaubsplaner Screenshot](docs/screenshot.gif) -->

---

## ✨ Features

- **Interactive Year-Round Calendar:** View public holidays, school holidays, and your planned vacation days for the entire year at a glance.
- **Smart Vacation Suggestions:** Get AI-powered recommendations for the most efficient use of your vacation days. The planner can create a full plan from scratch, extend your existing selections, or plan out the remainder of the year.
- **Bridge Day (Brückentag) Calculation:** Automatically identifies and highlights "bridge days" (days falling between a public holiday and a weekend) to help you get the longest possible time off with the fewest vacation days.
- **Multi-Region Support:** Plan around holidays in any of Germany's 16 federal states (`Bundesländer`).
- **International Holidays:** Optionally include public holidays from other countries in your planning.
- **Customizable Day Counting:** Flexible options to control how vacation days are counted (e.g., ignore weekends/holidays, treat days between Christmas and New Year's as half-days).
- **Vacation Day Tracking:** Keep a clear overview of your total, planned, and remaining vacation days.
- **Responsive Design:** Fully functional on both desktop and mobile devices.
- **Light & Dark Mode:** Automatically adapts to your system's theme preference.

## 🛠️ Tech Stack

- **Framework:** .NET 9
- **Frontend:** Blazor WebAssembly with Interactive Auto render mode.
- **Backend:** ASP.NET Core
- **UI Components:** [Radzen Blazor Components](https://blazor.radzen.com/)
- **Holiday Data:** Powered by the free and open [OpenHolidays API](https://openholidaysapi.org/).
- **Containerization:** Docker & Docker Compose
- **CI/CD:** GitHub Actions for automated Docker image publishing to GitHub Container Registry (ghcr.io).

## 🚀 Getting Started

You can run this project either directly using the .NET SDK or with Docker.

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for containerized approach)

### Running Locally with the .NET SDK

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Urlaubsplaner.git
    cd Urlaubsplaner
    ```
2.  **Navigate to the server project:**
    ```bash
    cd Server
    ```
3.  **Run the application:**
    ```bash
    dotnet run
    ```
4.  Open your browser and navigate to `https://localhost:5001` or `http://localhost:5000` (the exact URL will be shown in your console).

### Running with Docker Compose

This is the recommended way for a quick and isolated setup.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Urlaubsplaner.git
    cd Urlaubsplaner
    ```
2.  **Start the application using Docker Compose:**
    ```bash
    docker-compose up --build -d
    ```
3.  Open your browser and navigate to `http://localhost:8080` or `https://localhost:8081`.

##  usage

1.  **Select Your State(s):** Use the "Bundesländer" dropdown to select the German federal state(s) you want to plan for. This will load the correct public and school holidays.
2.  **Set Vacation Days:** Enter your total number of available vacation days for the year in the "Urlaubstage" numeric input.
3.  **Toggle Views:** Use the checkboxes to show or hide Public Holidays (`Feiertage`), School Holidays (`Ferien`), and Bridge Days (`Brückentage`).
4.  **Manual Planning:** Click directly on dates in the calendar to mark them as vacation days. The counters for "Planned" and "Remaining" days will update automatically.
5.  **Get Smart Suggestions:**
    - Click the **"Perfekten Urlaub vorschlagen"** (Suggest perfect vacation) button.
    - Choose a strategy:
        - `Vollständige Neuplanung`: Creates a brand new plan using all your vacation days, overwriting any current selections.
        - `Bestehende Auswahl erweitern`: Finds the best additions to your currently selected days.
        - `Restliches Jahr planen`: Creates a plan for the remaining part of the year from today.
    - A dialog will appear with the optimized vacation blocks.
    - Click **"Anwenden"** (Apply) to add these suggestions to your calendar.

## ⚙️ CI/CD

This project is configured with a GitHub Actions workflow in `.github/workflows/docker-publish.yml`. This workflow automates the following process:

- **Triggers:** The workflow runs on every push to the `master` branch and whenever a new version tag (e.g., `v1.2.3`) is pushed.
- **Build:** It builds the .NET application inside a Docker container.
- **Push:** It pushes the final Docker image to the GitHub Container Registry (ghcr.io).
- **Signing:** It signs the published Docker image using `sigstore/cosign` for enhanced security and verifiability.

## 🙏 Acknowledgments

- This project relies heavily on the fantastic and free **[OpenHolidays API](https://openholidaysapi.org/)** for providing comprehensive holiday data.
- The user interface is built with the excellent **[Radzen Blazor Components](https://blazor.radzen.com/)**.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE.txt](LICENSE.txt) file for details.
