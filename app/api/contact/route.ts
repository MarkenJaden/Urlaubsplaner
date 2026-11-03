import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ipBucket = requestBucket(request)
    const allowedIp = await allowAttempt(`contact-ip:${ipBucket}`, 5, 900)
    const allowedGlobal = await allowAttempt('contact-global', 60, 900)
    if (!allowedIp || !allowedGlobal) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte versuche es in einigen Minuten erneut.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    // Honeypot check: bots filling in the hidden website field are silently accepted without storing
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return NextResponse.json({ ok: true })
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Bitte gib deinen Namen an.' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse für Rückfragen an.' }, { status: 400 })
    }
    if (!subject || subject.length < 3) {
      return NextResponse.json({ error: 'Bitte gib einen kurzen Betreff an.' }, { status: 400 })
    }
    if (!message || message.length < 10) {
      return NextResponse.json({ error: 'Bitte schreibe eine Nachricht (mindestens 10 Zeichen).' }, { status: 400 })
    }

    await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut oder schreibe direkt per E-Mail.' },
      { status: 500 }
    )
  }
}
