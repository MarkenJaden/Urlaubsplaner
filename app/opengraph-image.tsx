import { ImageResponse } from 'next/og'

export const alt = 'Urlaubsplaner – Maximale freie Tage mit Brückentagen & Schulferien'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f3d3e 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top brand bar */}
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
              background: 'rgba(16, 185, 129, 0.18)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              color: '#6ee7b7',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            100 % kostenlos · DE · AT · CH
          </div>
        </div>

        {/* Main headline & efficiency card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1050px' }}>
          <div
            style={{
              fontSize: '58px',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Maximale freie Tage mit</span>
            <span style={{ color: '#38bdf8' }}>Brückentagen &amp; Schulferien</span>
          </div>

          <div
            style={{
              fontSize: '25px',
              color: '#cbd5e1',
              lineHeight: 1.4,
              maxWidth: '920px',
            }}
          >
            Smarter Online-Urlaubsplaner mit Brückentage-Optimierer, Ferien-Heatmap aller 16 Bundesländer, gemeinsamem Teilen &amp; Google-Kalender-Abo.
          </div>
        </div>

        {/* Bottom feature pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: '24px',
            borderTop: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                padding: '10px 18px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.16)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#e0f2fe',
                fontSize: '19px',
                fontWeight: 600,
              }}
            >
              1 Urlaubstag → 4 Tage frei
            </div>
            <div
              style={{
                display: 'flex',
                padding: '10px 18px',
                borderRadius: '12px',
                background: 'rgba(251, 191, 36, 0.14)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                color: '#fef3c7',
                fontSize: '19px',
                fontWeight: 600,
              }}
            >
              Schulferien-Heatmap
            </div>
            <div
              style={{
                display: 'flex',
                padding: '10px 18px',
                borderRadius: '12px',
                background: 'rgba(168, 85, 247, 0.16)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#f3e8ff',
                fontSize: '19px',
                fontWeight: 600,
              }}
            >
              Gemeinsam planen &amp; Kalender-Abo
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
