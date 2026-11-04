import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kontakt & Feedback',
  description:
    'Fragen, Feedback oder Verbesserungsvorschläge zum kostenlosen Online-Urlaubsplaner? Schreib direkt über das Kontaktformular oder per E-Mail.',
  alternates: {
    canonical: '/kontakt',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
