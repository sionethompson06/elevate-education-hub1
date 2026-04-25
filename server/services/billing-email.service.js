import { Resend } from 'resend';

let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

async function send(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[billing-email] (no RESEND_API_KEY) To: ${to} | Subject: ${subject}`);
    return { sent: false, reason: 'no_api_key' };
  }
  try {
    const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[billing-email] send error:', error.message || JSON.stringify(error));
      return { sent: false, reason: error.message };
    }
    console.log(`[billing-email] sent — id: ${data?.id} | To: ${to} | Subject: ${subject}`);
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error('[billing-email] unexpected error:', err.message);
    return { sent: false, reason: err.message };
  }
}

function fmtAmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(n || 0));
}

function fmtDate(str) {
  if (!str) return '—';
  const d = str.includes('T') ? new Date(str) : new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const wrap = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        ${content}
      </table>
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin-top:20px;">
        <tr><td style="text-align:center;color:#94a3b8;font-size:12px;line-height:1.7;padding:0 16px;">
          <strong>Elevate Education Hub</strong><br>
          This is an automated message. Questions? Contact us through the parent portal.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const header = (title, subtitle, bg = '#1a3c5e', subtitleColor = '#93c5fd') => `
  <tr><td style="background:${bg};padding:28px 32px;">
    <p style="margin:0 0 4px;font-size:11px;color:${subtitleColor};font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${subtitle}</p>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${title}</h1>
  </td></tr>`;

const btn = (url, label, color = '#1a3c5e') => `
  <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr><td style="background:${color};border-radius:8px;">
      <a href="${url}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;">${label}</a>
    </td></tr>
  </table>`;

// ── Payment Receipt Email ───────────────────────────────────────────────────────
// Call on successful payment (Stripe checkout, recurring, manual).
// amountCents (in cents) OR amountDollars (already converted).
// lineItems: [{ programName, studentName, amount }]

export async function sendPaymentReceiptEmail({
  to,
  parentName,
  amountCents,
  amountDollars,
  paidDate,
  method,
  invoiceId,
  lineItems = [],
}) {
  const amount = amountDollars != null ? amountDollars : (amountCents ?? 0) / 100;
  const methodLabel = method === 'stripe' ? 'Credit Card (Stripe)' : method === 'manual' ? 'Manual / Cash' : method || 'Online';
  const billUrl = `${APP_URL}/parent/statements`;

  const lineRows = lineItems.map(li => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 8px;color:#1e293b;font-size:14px;">${li.programName || '—'}</td>
      <td style="padding:10px 8px;color:#475569;font-size:14px;">${li.studentName || '—'}</td>
      <td style="padding:10px 8px;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${fmtAmt(li.amount)}</td>
    </tr>
  `).join('');

  const itemsTable = lineItems.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0 8px;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:8px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Program</th>
          <th style="text-align:left;padding:8px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Student</th>
          <th style="text-align:right;padding:8px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
  ` : '';

  const html = wrap(`
    ${header('Payment Receipt', 'Elevate Education Hub')}
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Hi ${parentName},</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">Your payment has been successfully processed. Thank you!</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 2px;font-size:11px;color:#16a34a;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Amount Paid</p>
            <p style="margin:0;font-size:28px;font-weight:700;color:#15803d;">${fmtAmt(amount)}</p>
          </td>
          <td style="padding:16px 20px;text-align:right;vertical-align:top;">
            <p style="margin:0;font-size:12px;color:#64748b;">Receipt #FI-${invoiceId || '—'}</p>
            <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Date: ${fmtDate(paidDate)}</p>
            <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Method: ${methodLabel}</p>
          </td>
        </tr>
      </table>

      ${itemsTable}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1a3c5e;margin-top:${lineItems.length ? '4px' : '20px'};">
        <tr>
          <td style="padding:12px 0;font-size:15px;font-weight:700;color:#1e293b;">Total Paid</td>
          <td style="padding:12px 0;font-size:18px;font-weight:700;color:#15803d;text-align:right;">${fmtAmt(amount)}</td>
        </tr>
      </table>

      <p style="margin:20px 0 4px;color:#475569;font-size:14px;line-height:1.7;">Your enrollment is now active. View your full payment history and download receipts from the billing portal.</p>
      ${btn(billUrl, 'View Statements & Receipts →')}
    </td></tr>
  `);

  return send(to, `Payment Receipt — ${fmtAmt(amount)} Confirmed`, html);
}

// ── Enhanced Payment Failed Email ──────────────────────────────────────────────
// Replaces the basic sendPaymentFailedEmail in email.service.js for billing flows.

export async function sendPaymentFailedEmail({
  to,
  parentName,
  amountCents,
  amountDollars,
  programName,
  invoiceId,
  dueDate,
}) {
  const amount = amountDollars != null ? amountDollars : (amountCents ? amountCents / 100 : null);
  const billingUrl = `${APP_URL}/parent/payments`;

  const html = wrap(`
    ${header('Payment Failed', 'Elevate Education Hub', '#dc2626', '#fca5a5')}
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Hi ${parentName},</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
        We were unable to process your payment. Please update your payment method to keep your enrollment active.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
        <tr><td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:5px 0;color:#64748b;font-size:14px;">Program</td>
              <td style="padding:5px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${programName || 'Your enrollment'}</td>
            </tr>
            ${invoiceId ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Invoice</td><td style="padding:5px 0;color:#1e293b;font-size:14px;text-align:right;">#FI-${invoiceId}</td></tr>` : ''}
            ${amount != null ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Amount Due</td><td style="padding:5px 0;color:#dc2626;font-weight:700;font-size:16px;text-align:right;">${fmtAmt(amount)}</td></tr>` : ''}
            ${dueDate ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Due Date</td><td style="padding:5px 0;color:#1e293b;font-size:14px;text-align:right;">${fmtDate(dueDate)}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>

      <p style="margin:20px 0 4px;color:#475569;font-size:14px;line-height:1.7;">
        <strong>What to do next:</strong> Visit the billing portal to update your payment method and retry the payment. If you need assistance, please reach out to our team through the portal.
      </p>
      ${btn(billingUrl, 'Update Payment Method →', '#dc2626')}
    </td></tr>
  `);

  return send(to, `Action Required: Payment Failed — ${programName || 'Your Enrollment'}`, html);
}

// ── Past Due Reminder Email ────────────────────────────────────────────────────
// Triggered manually from admin via POST /api/billing/send-past-due-reminder

export async function sendPastDueReminderEmail({
  to,
  parentName,
  amountCents,
  amountDollars,
  dueDate,
  daysOverdue = 0,
  invoiceId,
  programNames = [],
}) {
  const amount = amountDollars != null ? amountDollars : (amountCents ?? 0) / 100;
  const billingUrl = `${APP_URL}/parent/payments`;
  const urgencyColor = daysOverdue >= 30 ? '#dc2626' : daysOverdue >= 14 ? '#ea580c' : '#d97706';
  const programLabel = programNames.length > 0 ? programNames.join(', ') : 'your enrollment';

  const html = wrap(`
    ${header('Payment Reminder', 'Elevate Education Hub')}
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Hi ${parentName},</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
        This is a friendly reminder that your payment for <strong>${programLabel}</strong> is past due.
        Please take a moment to submit your payment to keep your enrollment active.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
        <tr><td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${invoiceId ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Invoice</td><td style="padding:5px 0;color:#1e293b;font-size:14px;text-align:right;">#FI-${invoiceId}</td></tr>` : ''}
            <tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Amount Due</td><td style="padding:5px 0;color:${urgencyColor};font-weight:700;font-size:16px;text-align:right;">${fmtAmt(amount)}</td></tr>
            ${dueDate ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Original Due Date</td><td style="padding:5px 0;color:#1e293b;font-size:14px;text-align:right;">${fmtDate(dueDate)}</td></tr>` : ''}
            ${daysOverdue > 0 ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Days Past Due</td><td style="padding:5px 0;color:${urgencyColor};font-weight:600;font-size:14px;text-align:right;">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>

      <p style="margin:20px 0 4px;color:#475569;font-size:14px;line-height:1.7;">
        Please make your payment at your earliest convenience. If you have already submitted a payment or need to discuss payment arrangements, please contact us through the portal.
      </p>
      ${btn(billingUrl, 'Pay Now →')}
    </td></tr>
  `);

  return send(to, `Payment Reminder: ${fmtAmt(amount)} Past Due`, html);
}

// ── Upcoming Payment Reminder ──────────────────────────────────────────────────
// Returns { subject, html } — caller decides when/whether to send.
// No scheduling built-in; use for future automated reminders.

export function buildUpcomingPaymentReminderEmail({ parentName, amountDollars, programs = [], nextPaymentDate }) {
  const billingUrl = `${APP_URL}/parent/payments`;
  const programLabel = programs.length > 0 ? programs.join(', ') : 'your enrollment';
  const dateLabel = nextPaymentDate ? fmtDate(nextPaymentDate) : 'soon';

  const html = wrap(`
    ${header('Upcoming Payment', 'Elevate Education Hub')}
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Hi ${parentName},</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
        Your next payment for <strong>${programLabel}</strong> is scheduled for <strong>${dateLabel}</strong>.
        Please ensure your payment method is up to date to avoid any interruptions.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
        <tr><td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Programs</td><td style="padding:5px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${programLabel}</td></tr>
            <tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Payment Date</td><td style="padding:5px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${dateLabel}</td></tr>
            ${amountDollars != null ? `<tr><td style="padding:5px 0;color:#64748b;font-size:14px;">Amount</td><td style="padding:5px 0;color:#1a3c5e;font-weight:700;font-size:16px;text-align:right;">${fmtAmt(amountDollars)}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>

      ${btn(billingUrl, 'Review Billing →')}
    </td></tr>
  `);

  return {
    subject: `Upcoming Payment: ${amountDollars != null ? fmtAmt(amountDollars) + ' due ' : ''}${dateLabel}`,
    html,
  };
}
