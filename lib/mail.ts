import nodemailer from 'nodemailer'
import { getSmtpSettings } from './admin'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function isSmtpReady(): Promise<boolean> {
  const cfg = await getSmtpSettings()
  return Boolean(cfg.enabled && cfg.host && cfg.fromEmail)
}

async function createSmtpTransport() {
  const cfg = await getSmtpSettings()
  if (!cfg.enabled || !cfg.host || !cfg.fromEmail) {
    throw new Error('SMTP ist nicht aktiviert oder unvollständig konfiguriert.')
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port || 587,
    secure: Boolean(cfg.secure),
    ...(cfg.user
      ? {
          auth: {
            user: cfg.user,
            pass: cfg.pass || '',
          },
        }
      : {}),
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  const fromHeader = cfg.fromName
    ? `"${cfg.fromName.replace(/"/g, '')}" <${cfg.fromEmail}>`
    : cfg.fromEmail

  return { transport, fromHeader, cfg }
}

function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background-color:#0f172a;color:#ffffff;font-size:18px;font-weight:700;">
              🌴 Urlaubsplaner
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;color:#27272a;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;">
              Diese E-Mail wurde automatisch von deinem Urlaubsplaner gesendet.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendPasswordResetEmail(params: {
  to: string
  name?: string | null
  resetUrl: string
}) {
  const { transport, fromHeader } = await createSmtpTransport()
  const greeting = params.name ? `Hallo ${escapeHtml(params.name)},` : 'Hallo,'
  const safeUrl = escapeHtml(params.resetUrl)

  const html = wrapEmailHtml(
    'Passwort zurücksetzen – Urlaubsplaner',
    `<p style="margin-top:0;">${greeting}</p>
     <p>du hast eine Anfrage zum Zurücksetzen deines Passworts für dein <strong>Urlaubsplaner</strong>-Konto gestellt.</p>
     <p style="margin:24px 0;">
       <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
         Neues Passwort festlegen
       </a>
     </p>
     <p style="font-size:13px;color:#52525b;">
       Oder kopiere diesen Link in deinen Browser:<br />
       <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${safeUrl}</a>
     </p>
     <p style="font-size:13px;color:#71717a;margin-bottom:0;">
       Dieser Link ist <strong>60 Minuten</strong> gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail einfach ignorieren.
     </p>`
  )

  const text = `${params.name ? `Hallo ${params.name},` : 'Hallo,'}\n\ndu hast eine Anfrage zum Zurücksetzen deines Passworts für dein Urlaubsplaner-Konto gestellt.\n\nÖffne folgenden Link, um ein neues Passwort festzulegen (60 Minuten gültig):\n${params.resetUrl}\n\nFalls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.`

  await transport.sendMail({
    from: fromHeader,
    to: params.to,
    subject: 'Passwort zurücksetzen – Urlaubsplaner',
    text,
    html,
  })
}

export async function sendTestSmtpEmail(to: string) {
  const { transport, fromHeader, cfg } = await createSmtpTransport()
  const html = wrapEmailHtml(
    'SMTP-Test erfolgreich – Urlaubsplaner',
    `<p style="margin-top:0;"><strong>Der SMTP-Versand funktioniert! 🎉</strong></p>
     <p>Dein Urlaubsplaner-Server (${escapeHtml(cfg.host || '')}:${cfg.port || 587}) kann erfolgreich E-Mails für Passwort-Resets und Rundmails versenden.</p>`
  )
  await transport.sendMail({
    from: fromHeader,
    to,
    subject: '✅ SMTP-Test erfolgreich – Urlaubsplaner',
    text: `Der SMTP-Versand funktioniert! Dein Urlaubsplaner-Server (${cfg.host}:${cfg.port}) ist bereit für Passwort-Resets und Rundmails.`,
    html,
  })
}

export async function sendAdminBroadcastEmail(params: {
  recipients: string[]
  subject: string
  message: string
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { transport, fromHeader } = await createSmtpTransport()
  const cleanSubject = params.subject.trim()
  const cleanMessage = params.message.trim()

  const paragraphs = cleanMessage
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('')

  const html = wrapEmailHtml(cleanSubject, paragraphs)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const email of params.recipients) {
    try {
      await transport.sendMail({
        from: fromHeader,
        to: email,
        subject: cleanSubject,
        text: cleanMessage,
        html,
      })
      sent++
    } catch (err) {
      failed++
      if (errors.length < 5) {
        errors.push(`${email}: ${err instanceof Error ? err.message : 'Versandfehler'}`)
      }
    }
  }

  return { sent, failed, errors }
}
