import { ImageResponse } from 'next/og'

function clampText(value: string | null, fallback: string, maxLen: number): string {
  if (!value) return fallback
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!cleaned) return fallback
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') === 'share' ? 'share' : 'planner'
  const label = clampText(searchParams.get('label'), 'Geteilter Urlaubsplan', 48)
  const permission = searchParams.get('permission') === 'edit' ? 'edit' : 'view'
  const year = /^\d{4}$/.test(searchParams.get('year') ?? '') ? searchParams.get('year')! : ''

  const badgeText =
    mode === 'share'
      ? permission === 'edit'
        ? 'Live-Freigabe · Gemeinsam bearbeiten'
        : 'Live-Freigabe · Im Kalender vergleichen'
      : `Kostenlos & ohne Anmeldung${year ? ` · ${year}` : ''}`

  const headlineTop = mode === 'share' ? label : `Optimale Urlaubsplanung${year ? ` ${year}` : ''}`
  const headlineAccent =
    mode === 'share'
      ? permission === 'edit'
        ? 'Gemeinsam Urlaub planen & abgleichen'
        : 'Deinen Plan live danebenlegen & vergleichen'
      : 'Brückentage & Schulferien maximal nutzen'

  const subline =
    mode === 'share'
      ? 'Öffne den Link, lege deinen eigenen Urlaubsplan daneben und sieh sofort alle gemeinsamen freien Tage im Jahreskalender.'
      : 'Smarter Brückentage-Algorithmus, 4- & 5-Tage-Woche, Ferien-Heatmap aller Bundesländer & Google-Kalender-Abo.'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '54px 64px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #064e3b 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              U
            </div>
            <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              urlaubsplaner.me
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.5)',
              color: '#6ee7b7',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            {badgeText}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1060px' }}>
          <div
            style={{
              fontSize: '54px',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>{headlineTop}</span>
            <span style={{ color: '#38bdf8' }}>{headlineAccent}</span>
          </div>

          <div
            style={{
              fontSize: '24px',
              color: '#cbd5e1',
              lineHeight: 1.4,
              maxWidth: '940px',
            }}
          >
            {subline}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            width: '100%',
            paddingTop: '22px',
            borderTop: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.16)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#e0f2fe',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Echtzeit-Paar-Abgleich
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#d1fae5',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            4- &amp; 5-Tage-Woche
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'rgba(251, 191, 36, 0.14)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#fef3c7',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            100 % kostenlos &amp; werbefrei
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
