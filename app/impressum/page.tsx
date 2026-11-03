import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Impressum · Urlaubsplaner',
  description: 'Impressum und Anbieterkennzeichnung gemäß § 5 DDG für den Urlaubsplaner.',
}

export default function ImpressumPage() {
  return (
    <main className="container max-w-3xl space-y-6 py-8 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-primary underline font-medium">
          ← Zurück zum Urlaubsplaner
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link href="/datenschutz" className="underline hover:text-foreground">
            Datenschutzerklärung
          </Link>
          <span>·</span>
          <Link href="/kontakt" className="underline hover:text-foreground">
            Kontaktformular
          </Link>
        </div>
      </div>

      <h1 className="text-2xl font-bold">Impressum</h1>

      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Angaben gemäß § 5 DDG</h2>
        <address className="not-italic space-y-1">
          <p className="font-semibold text-base">Jan Jaden Schmidt</p>
          <p>Johannes-Rau-Weg 17</p>
          <p>57223 Kreuztal</p>
          <p>Deutschland</p>
        </address>
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Kontakt</h2>
        <p>
          <strong>Telefon:</strong>{' '}
          <a href="tel:+4917641792918" className="text-primary underline">
            0176 41792918
          </a>
        </p>
        <p>
          <strong>E-Mail:</strong>{' '}
          <a href="mailto:jjsch1410@gmail.com" className="text-primary underline">
            jjsch1410@gmail.com
          </a>
        </p>
        <p>
          <strong>Kontaktformular:</strong>{' '}
          <Link href="/kontakt" className="text-primary underline">
            Direkt online Nachricht senden
          </Link>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          Jan Jaden Schmidt
          <br />
          Johannes-Rau-Weg 17
          <br />
          57223 Kreuztal
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Alle Angaben zu gesetzlichen Feiertagen, Schulferien und Brückentagen werden mit größter Sorgfalt bereitgestellt, erfolgen jedoch ohne Gewähr auf Vollständigkeit, Aktualität und Richtigkeit. Maßgeblich sind stets die offiziellen Bekanntmachungen der jeweiligen Bundesländer und Kultusministerien.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Haftung für Links</h2>
        <p>
          Unser Angebot enthält gegebenenfalls Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
      </section>
    </main>
  )
}
