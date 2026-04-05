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
    console.log(`[email] (no RESEND_API_KEY) To: ${to} | Subject: ${subject}`);
    return { sent: false, reason: 'no_api_key' };
  }
  const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error('[email] send error:', error.message || JSON.stringify(error));
    return { sent: false, reason: error.message };
  }
  console.log(`[email] sent — id: ${data?.id} | To: ${to}`);
  return { sent: true, id: data?.id };
}

export async function sendInviteEmail(to, firstName, inviteToken) {
  const url = `${APP_URL}/register?token=${inviteToken}`;
  await send(to, 'You\'re invited to Elevate Education Hub', `
    <p>Hi ${firstName},</p>
    <p>You've been invited to join the Elevate Education Hub portal.</p>
    <p><a href="${url}" style="background:#1a3c5e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Set Up Your Account</a></p>
    <p>This link expires in 72 hours.</p>
    <p>— Elevate Education Hub</p>
  `);
}

export async function sendApplicationReceivedEmail(to, parentName) {
  await send(to, 'Application Received — Elevate Education Hub', `
    <p>Hi ${parentName},</p>
    <p>Thank you for submitting your application to Elevate Education Hub. Our team will review it and contact you shortly.</p>
    <p>— The Elevate Team</p>
  `);
}

export async function sendEnrollmentApprovedEmail(to, studentName, programName) {
  await send(to, `Enrollment Approved: ${programName}`, `
    <p>Great news! ${studentName}'s enrollment in <strong>${programName}</strong> has been approved.</p>
    <p><a href="${APP_URL}/parent/programs">Complete your enrollment and payment →</a></p>
    <p>— Elevate Education Hub</p>
  `);
}

export async function sendPaymentConfirmationEmail(to, parentName, amount, programName) {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  await send(to, `Payment Confirmed: ${programName}`, `
    <p>Hi ${parentName},</p>
    <p>Your payment of <strong>${formatted}</strong> for <strong>${programName}</strong> has been confirmed. Your enrollment is now active.</p>
    <p><a href="${APP_URL}/parent/dashboard">Visit your dashboard →</a></p>
    <p>— Elevate Education Hub</p>
  `);
}

export async function sendPaymentFailedEmail(to, parentName, programName) {
  await send(to, `Payment Failed: ${programName}`, `
    <p>Hi ${parentName},</p>
    <p>We were unable to process your payment for <strong>${programName}</strong>. Please update your payment method.</p>
    <p><a href="${APP_URL}/parent/payments">Update payment method →</a></p>
    <p>— Elevate Education Hub</p>
  `);
}
