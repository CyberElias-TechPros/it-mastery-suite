import { log } from './logger';
import type { Env } from '../types';

/**
 * Transactional email. Cloudflare Workers cannot open SMTP sockets, so an HTTP
 * email provider is used. Resend is the default because it is a single fetch
 * call with no SDK; any provider with an HTTP API can be swapped in here.
 *
 * Email is best-effort: a delivery failure is logged but never fails the
 * originating request.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function emailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

export async function sendEmail(env: Env, message: EmailMessage): Promise<boolean> {
  if (!emailConfigured(env)) {
    log('warn', 'email_not_configured', { subject: message.subject });
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      log('error', 'email_send_failed', { status: response.status, subject: message.subject });
      return false;
    }
    return true;
  } catch (error) {
    log('error', 'email_send_error', { error: String(error), subject: message.subject });
    return false;
  }
}
