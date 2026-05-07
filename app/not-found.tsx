export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#888' }}>404</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Seite nicht gefunden</p>
        <a href="/" style={{ color: '#3b82f6', textDecoration: 'underline', marginTop: '1rem', display: 'inline-block' }}>Zurück zum Kalender</a>
      </div>
    </div>
  )
}
