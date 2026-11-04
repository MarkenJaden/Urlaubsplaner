import type { Metadata } from 'next'
import Link from 'next/link'
import { CookieSettingsButton } from '@/components/legal/cookie-banner'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Informationen zum Datenschutz gemäß DSGVO und TDDDG für den Urlaubsplaner.',
  alternates: {
    canonical: '/datenschutz',
  },
}

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl space-y-6 py-8 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-primary underline font-medium">
          ← Zurück zum Urlaubsplaner
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link href="/impressum" className="underline hover:text-foreground">
            Impressum
          </Link>
          <span>·</span>
          <Link href="/kontakt" className="underline hover:text-foreground">
            Kontaktformular
          </Link>
          <span>·</span>
          <CookieSettingsButton />
        </div>
      </div>

      <h1 className="text-2xl font-bold">Datenschutzerklärung</h1>

      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">1. Verantwortlicher (Art. 13 Abs. 1 lit. a DSGVO)</h2>
        <address className="not-italic space-y-1">
          <p className="font-semibold">Jan Jaden Schmidt</p>
          <p>Johannes-Rau-Weg 17</p>
          <p>57223 Kreuztal, Deutschland</p>
          <p>
            Telefon:{' '}
            <a href="tel:+4917641792918" className="text-primary underline">
              0176 41792918
            </a>
          </p>
          <p>
            E-Mail:{' '}
            <a href="mailto:jjsch1410@gmail.com" className="text-primary underline">
              jjsch1410@gmail.com
            </a>
          </p>
        </address>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Nutzung ohne Konto (Gastmodus)</h2>
        <p>
          Ohne Anmeldung speichert der Urlaubsplaner deinen Plan und deine Einstellungen im lokalen Speicher (<code>localStorage</code>) deines Browsers. Für die automatische Berechnung optimaler Urlaubsvorschläge werden das gewählte Land, das Bundesland, das Jahr, dein Budget sowie bereits geplante Tage an unseren Server übermittelt, dort in Echtzeit berechnet und nicht personenbezogen gespeichert. Du kannst die lokalen Daten jederzeit über „Planung zurücksetzen“ im Drei-Punkte-Menü oder über deine Browser-Einstellungen löschen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Nutzerkonto &amp; Synchronisierung</h2>
        <p>
          Wenn du ein kostenloses Konto anlegst, speichern wir: deinen gewählten Benutzernamen, optional deine E-Mail-Adresse (z. B. für die Anmeldung oder das Zurücksetzen des Passworts), optional verknüpfte OAuth-Kennungen (Google oder GitHub, falls du diese Anmeldemethode wählst), dein Passwort ausschließlich als kryptografischen <code>scrypt</code>-Hash, einen Hash deines Wiederherstellungsschlüssels, den Zeitpunkt der letzten Kontoaktivität, deine Einstellungen (z. B. Region, Urlaubs- und Gleitzeitkontingent), deine geplanten Tage samt Notizen sowie zufällige Tokens für deine persönlichen Kalender-Abonnements. Eine E-Mail-Adresse ist optional; ein Konto kann auch rein mit Benutzername und Wiederherstellungsschlüssel genutzt werden.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. Bereitstellung des gewünschten Kontodienstes). Deine Daten bleiben gespeichert, bis du einzelne Einträge oder dein gesamtes Konto unter <em>Einstellungen → Konto löschen</em> entfernst; bei einer Kontolöschung werden sämtliche zugehörigen Urlaubseinträge, Kalender-Feeds und Freigabelinks endgültig aus der Datenbank gelöscht.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Teilen von Urlaubsplänen &amp; Kalender-Abonnement</h2>
        <p>
          <strong>Teilen-Funktion:</strong> Du kannst deinen Urlaubsplan aktiv mit anderen Personen teilen. Im Gastmodus werden die von dir freigegebenen Tage direkt im erzeugten Link kodiert. Mit einem Konto kannst du Freigabelinks (mit Lese- oder Bearbeitungsrecht) erzeugen und diese jederzeit im Teilen-Dialog wieder widerrufen.
        </p>
        <p>
          <strong>Kalender-Abonnement (iCal / Google Kalender):</strong> Über deine persönliche Feed-URL können Kalender-Programme (z. B. Google Kalender, Apple Kalender, Outlook) deine geplanten Tage abrufen. Welche Inhalte (Urlaub, Gleittage, Notizen, Feiertage, Schulferien) im jeweiligen Feed enthalten sind, bestimmst du selbst. Wenn du den Link an einen Drittanbieter wie Google Kalender übergibst, ruft dieser Anbieter die URL regelmäßig von unserem Server ab; du kannst das Token jederzeit in den Einstellungen neu generieren oder einzelne Feeds löschen, wodurch der bisherige Link sofort ungültig wird.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Cookies, LocalStorage &amp; Einwilligung (§ 25 TDDDG)</h2>
        <p>
          Wir unterscheiden strikt zwischen technisch notwendigen Speicherzugriffen und optionalen Funktionen:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Technisch notwendige Cookies &amp; LocalStorage (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b/f DSGVO):</strong> Sitzungs-Cookies für die Anmeldung (Gültigkeit bis zu 30 Tage oder bis zur Abmeldung), Schutz-Cookies gegen gefälschte Anfragen (CSRF), deine lokale Urlaubsplanung (<code>urlaubsplaner_config</code>) sowie der Speicherstatus deiner Datenschutz-Entscheidung (<code>urlaubsplaner_cookie_consent_v1</code>).
          </li>
          <li>
            <strong>Komfort &amp; Darstellung:</strong> Speicherung von Darstellungspräferenzen (z. B. Hell-/Dunkelmodus, eingeblendete Vergleichspläne).
          </li>
          <li>
            <strong>Optionale Statistik (nur nach Einwilligung gemäß § 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO):</strong> Erst wenn du im Cookie-Banner aktiv zustimmst, wird unser selbst gehostetes Statistik-Skript (Umami) geladen.
          </li>
        </ul>
        <p>
          Deine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen oder anpassen:{' '}
          <CookieSettingsButton />.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Nutzungsstatistik &amp; Reichweitenmessung</h2>
        <p>
          Um die Stabilität des Dienstes zu gewährleisten und in Echtzeit zu erkennen, wie viele registrierte und nicht registrierte Nutzer den Planer verwenden, erfassen wir aggregierte technische Kennzahlen (Tageszähler, Geräteklasse, aufgerufener Seitenpfad ohne private Query-Parameter sowie eine zufällige Kennung ohne IP-Speicherung in der Statistik-Datenbank; Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO). Darüber hinaus betreiben wir bei erteilter Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) auf unserem eigenen Server unter <code>umami.urlaubsplaner.me</code> die datenschutzfreundliche Open-Source-Software Umami. Es werden dabei keinerlei Daten an Werbenetzwerke oder sonstige Dritte weitergegeben.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. Kontaktformular &amp; E-Mail-Kontakt</h2>
        <p>
          Wenn du uns über das <Link href="/kontakt" className="text-primary underline">Kontaktformular</Link> oder per E-Mail kontaktierst, verarbeiten wir deinen Namen, deine E-Mail-Adresse, den Betreff und deine Nachricht ausschließlich zur Bearbeitung deiner Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Die Nachrichten werden nach abschließender Bearbeitung gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. Server-Sicherheit &amp; Missbrauchsschutz</h2>
        <p>
          Beim Aufruf der Website verarbeitet unser Webserver technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, angefragte Ressource, User-Agent), um die Seite sicher auszuliefern. Zum Schutz vor automatisierten Angriffen (z. B. Passwort-Raten oder Spam beim Kontaktformular) wird kurzzeitig ein nicht umkehrbarer Hashwert der IP-Adresse im Arbeitsspeicher geprüft (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. Externe Datenquellen (OpenHolidays API)</h2>
        <p>
          Gesetzliche Feiertage und Schulferien ruft unser Server im Hintergrund von der Open-Source-Schnittstelle <code>openholidaysapi.org</code> ab. Dein Browser stellt dabei keine direkte Verbindung zu diesem Drittdienst her; es werden lediglich Land, Bundesland und Jahr durch unseren Server abgefragt, ohne dass personenbezogene Daten deiner Sitzung übertragen werden.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">10. Deine Rechte als betroffene Person</h2>
        <p>
          Du hast gegenüber dem Verantwortlichen jederzeit das Recht auf:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Auskunft</strong> über deine gespeicherten Daten (Art. 15 DSGVO),</li>
          <li><strong>Berichtigung</strong> unrichtiger Daten (Art. 16 DSGVO),</li>
          <li><strong>Löschung</strong> deiner Daten (Art. 17 DSGVO) – im Konto auch direkt per Selbstbedienung möglich,</li>
          <li><strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO),</li>
          <li><strong>Datenübertragbarkeit</strong> im JSON-, CSV- oder iCal-Format (Art. 20 DSGVO),</li>
          <li><strong>Widerspruch</strong> gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO),</li>
          <li><strong>Widerruf</strong> erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        </ul>
        <p>
          Zudem steht dir das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde zu (Art. 77 DSGVO), beispielsweise bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW).
        </p>
      </section>
    </main>
  )
}
