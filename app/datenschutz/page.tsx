import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz · Urlaubsplaner' }

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl space-y-6 py-8 text-sm leading-relaxed">
      <a href="/" className="text-primary underline">← Zurück zum Planer</a>
      <h1 className="text-2xl font-bold">Datenschutzerklärung</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Verantwortlicher</h2>
        {/* TODO: Name, Anschrift und Kontakt-E-Mail des Betreibers ergänzen (Art. 13 Abs. 1 lit. a DSGVO). */}
        <p className="rounded-md border border-dashed p-3 text-muted-foreground">Die Angaben zum Verantwortlichen werden in Kürze ergänzt.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Nutzung ohne Konto</h2>
        <p>Ohne Anmeldung speichert der Urlaubsplaner deinen Plan und deine Einstellungen ausschließlich im lokalen Speicher (localStorage) deines Browsers. Diese Daten verlassen dein Gerät nur, wenn du Funktionen nutzt, die sie benötigen: Für Urlaubsvorschläge werden Region, Jahr, Budget und bereits geplante Tage an unseren Server übermittelt, dort berechnet und nicht gespeichert. Du kannst die lokalen Daten jederzeit über „Planung zurücksetzen“ oder die Browser-Einstellungen löschen.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Nutzerkonto</h2>
        <p>Wenn du ein Konto anlegst, speichern wir: Benutzername, optional einen Anzeigenamen, dein Passwort ausschließlich als scrypt-Hash, einen Hash deines Wiederherstellungsschlüssels, deine Einstellungen (z. B. Region, Urlaubs- und Gleitzeitkontingent), deine geplanten Tage samt Notizen sowie ein Token für dein Kalender-Abonnement. Eine E-Mail-Adresse ist nicht erforderlich. Meldest du dich über den älteren Keycloak-Login an, übernehmen wir von dort zusätzlich deinen Namen und deine E-Mail-Adresse.</p>
        <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Dienstes). Die Daten bleiben gespeichert, bis du dein Konto unter Einstellungen → Konto löschen entfernst; dabei werden alle zugehörigen Einträge gelöscht.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies</h2>
        <p>Wir setzen nur technisch notwendige Cookies für die Anmeldung: ein Sitzungs-Cookie (gültig bis zu 30 Tage oder bis zur Abmeldung) sowie Cookies zum Schutz vor gefälschten Anfragen (CSRF) und zur Weiterleitung nach dem Login. Die beiden letzteren werden auch ohne Anmeldung gesetzt, sobald die Seite den Anmeldestatus prüft; sie enthalten keine Angaben über dich und gelten nur für die Browsersitzung. Tracking- oder Werbe-Cookies verwenden wir nicht. Da diese Cookies für den ausdrücklich gewünschten Dienst unbedingt erforderlich sind, ist keine Einwilligung nötig (§ 25 Abs. 2 Nr. 2 TDDDG); ein Cookie-Banner gibt es deshalb nicht.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Server und Sicherheit</h2>
        <p>Beim Aufruf der Seite verarbeitet unser Server technisch notwendige Verbindungsdaten wie IP-Adresse, Zeitpunkt und aufgerufene Adresse, um die Seite auszuliefern. Zum Schutz vor Missbrauch (z. B. Passwort-Raten) wird bei Anmeldung und Registrierung ein Hashwert der IP-Adresse höchstens eine Stunde lang gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb des Dienstes).</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Externe Dienste</h2>
        <p>Feiertage und Schulferien bezieht unser Server von der OpenHolidays API (openholidaysapi.org). Dabei werden nur Land, Region und Zeitraum abgefragt, keine Daten über dich; dein Browser verbindet sich nicht selbst mit diesem Dienst. Schriftarten werden von unserem Server ausgeliefert, nicht von Drittanbietern. Analyse- oder Tracking-Dienste setzen wir nicht ein.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Deine Rechte</h2>
        <p>Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Deine Planung kannst du jederzeit selbst exportieren und dein Konto selbst löschen. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).</p>
      </section>
    </main>
  )
}
