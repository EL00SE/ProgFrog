import "server-only";

import { Resend } from "resend";

import { env } from "@/env";

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Send one transactional email. Never throws — if there's no `RESEND_API_KEY`,
 * or Resend rejects the send (e.g. the shared `onboarding@resend.dev` sender
 * only delivers to your own Resend-account address), the link is written to the
 * server log so it's still recoverable.
 */
async function send({ to, subject, html, text }: Mail) {
  if (env.RESEND_API_KEY) {
    try {
      const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
        text,
      });
      if (!error) return;
      console.warn(`[email] Resend rejected send to ${to}: ${error.message}`);
    } catch (err) {
      console.warn(`[email] send to ${to} failed:`, err);
    }
  }
  console.info(
    `\n[email:link] To: ${to}\n[email:link] ${subject}\n[email:link] ${text}\n`,
  );
}

function layout(heading: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#14110c;margin:0;padding:32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
      <tr><td style="font-size:20px;font-weight:700;color:#6b4310;padding-bottom:12px">Prog<span style="color:#a86a1a">Frog</span></td></tr>
      <tr><td style="font-size:16px;font-weight:600;color:#111;padding-bottom:8px">${heading}</td></tr>
      <tr><td style="font-size:14px;color:#444;line-height:1.5;padding-bottom:20px">${body}</td></tr>
      <tr><td><a href="${cta.url}" style="display:inline-block;background:#a86a1a;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${cta.label}</a></td></tr>
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
