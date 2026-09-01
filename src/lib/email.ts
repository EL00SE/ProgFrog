import "server-only";

import { Resend } from "resend";

import { env } from "@/env";

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Send one transactional email. When `RESEND_API_KEY` is unset the link is
 * logged to the server console instead — enough to develop the flows locally
 * without an email provider.
 */
async function send({ to, subject, html, text }: Mail) {
  if (!env.RESEND_API_KEY) {
    console.info(
      `\n[email:dev] To: ${to}\n[email:dev] ${subject}\n[email:dev] ${text}\n`,
    );
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
}

function layout(heading: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b3b2e;margin:0;padding:32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
      <tr><td style="font-size:20px;font-weight:700;color:#0b3b2e;padding-bottom:12px">ProgFrog</td></tr>
      <tr><td style="font-size:16px;font-weight:600;color:#111;padding-bottom:8px">${heading}</td></tr>
      <tr><td style="font-size:14px;color:#444;line-height:1.5;padding-bottom:20px">${body}</td></tr>
      <tr><td><a href="${cta.url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${cta.label}</a></td></tr>
      <tr><td style="font-size:12px;color:#888;padding-top:20px;word-break:break-all">Or paste this link into your browser:<br>${cta.url}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function verificationEmail(to: string, url: string) {
  return send({
    to,
    subject: "Verify your ProgFrog email",
    text: `Confirm your email to activate your ProgFrog account: ${url}`,
    html: layout(
      "Confirm your email",
      "Click below to activate your account. This link expires in 24 hours.",
      { label: "Verify email", url },
    ),
  });
}

export function passwordResetEmail(to: string, url: string) {
  return send({
    to,
    subject: "Reset your ProgFrog password",
    text: `Reset your ProgFrog password: ${url} (expires in 1 hour). If you didn't ask for this, ignore this email.`,
    html: layout(
      "Reset your password",
      "Click below to choose a new password. This link expires in 1 hour. If you didn't request it, you can ignore this email.",
      { label: "Reset password", url },
    ),
  });
}

export function accountExistsEmail(to: string, signInUrl: string) {
  return send({
    to,
    subject: "You already have a ProgFrog account",
    text: `Someone tried to sign up with this address, but it's already registered. Sign in here: ${signInUrl}`,
    html: layout(
      "You already have an account",
      "Someone just tried to sign up with this email address. If that was you, sign in instead — or reset your password if you've forgotten it.",
      { label: "Go to sign in", url: signInUrl },
    ),
  });
}
