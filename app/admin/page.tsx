import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const metadata: Metadata = {
  title: 'Admin-Dashboard · Urlaubsplaner',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/admin')
  }

  return <AdminDashboard />
}
