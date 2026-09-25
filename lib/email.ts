import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { eligibilityThreshold } from "@/lib/config";
import { qrPngBuffer } from "@/lib/qr";

// ---- Provider selection ----
// SMTP (e.g. a Gmail account + App Password, ~500 emails/day) when SMTP_HOST is
// set; otherwise Resend. Clients are built lazily so missing config never
// crashes the build.

export function emailProvider(): "smtp" | "resend" | null {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

/** Human-readable reason emails can't be sent, or null when configured. */
export function emailConfigError(): string | null {
  if (process.env.SMTP_HOST && !(process.env.SMTP_USER && process.env.SMTP_PASS))
    return "SMTP_HOST is set but SMTP_USER / SMTP_PASS are missing — no emails sent.";
  if (!emailProvider())
    return "Email is not configured — set SMTP_HOST / SMTP_USER / SMTP_PASS (Gmail) or RESEND_API_KEY. No emails sent.";
  return null;
}

/**
 * Failure that will hit every remaining student too (auth rejected, daily
 * quota reached). The batch stops instead of burning retries per student.
 */
export class FatalEmailError extends Error {}

function fromAddress(): string {
  const configured = process.env.EMAIL_FROM;
  if (emailProvider() === "smtp") {
    // Gmail / Office 365 only send as the logged-in account: keep the display
    // name from EMAIL_FROM but always use SMTP_USER as the address.
    const name = configured?.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() || "ATIC Team";
    return `"${name.replace(/"/g, "")}" <${process.env.SMTP_USER}>`;
  }
  return configured ?? "Event Team <onboarding@resend.dev>";
}

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _smtp: Transporter | null = null;
function getSmtp(): Transporter {
  if (!_smtp) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    _smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades with STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _smtp;
}

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** `inlineId` makes the attachment referenceable as <img src="cid:inlineId">. */
  attachments?: { filename: string; content: Buffer; contentType: string; inlineId?: string }[];
}

/** Send one email through the configured provider; returns the provider message id. */
async function deliver(mail: Mail): Promise<string | undefined> {
  const configError = emailConfigError();
  if (configError) throw new FatalEmailError(configError);

  if (emailProvider() === "smtp") {
    try {
      const info = await getSmtp().sendMail({
        from: fromAddress(),
        replyTo: process.env.SMTP_USER,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.inlineId,
        })),
      });
      return info.messageId;
    } catch (e: any) {
      const detail = `${e?.response ?? ""} ${e?.message ?? ""}`;
      if (e?.code === "EAUTH" || e?.responseCode === 535)
        throw new FatalEmailError(
          "The mail server rejected the login — check SMTP_USER and SMTP_PASS (for Gmail, a 16-character App Password)."
        );
      if (/5\.4\.5|daily user sending limit|sending limit exceeded|quota/i.test(detail))
        throw new FatalEmailError("Daily sending limit reached — run it again in 24 hours to continue.");
      throw e;
    }
  }

  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      inlineContentId: a.inlineId,
    })),
  });
  if (error) {
    if (/daily_quota|monthly_quota/i.test(error.name ?? ""))
      throw new FatalEmailError("Resend sending quota reached — run it again later to continue.");
    throw new Error(error.message ?? "Resend send failed");
  }
  return data?.id;
}

// ---- Branded email layout (ATIC colours) ----
// Built with tables + bgcolor attributes: Gmail's phone app drops CSS
// backgrounds on <div>s, which left the white logo on a white background.
function publicBaseUrl(): string | null {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "");
  return base && /^https:\/\//.test(base) ? base : null;
}

const FONT = "Montserrat,Arial,Helvetica,sans-serif";
const H2 = "margin:0 0 12px;font-family:Arial Black,Arial,sans-serif;font-size:22px;line-height:1.2;text-transform:uppercase;letter-spacing:.5px";

function layout(body: string): string {
  const base = publicBaseUrl();
  const logo = base
    ? `<img src="${base}/atic-logo.png" alt="ATIC" width="95" height="48" style="display:block;height:48px;width:auto;border:0" />`
    : `<span style="color:#ffffff;font-size:24px;font-weight:900;letter-spacing:1px">ATIC</span>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0b12" style="background-color:#0b0b12">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:separate">
        <tr><td bgcolor="#0b0b12" style="background-color:#0b0b12;padding:22px 24px;border-bottom:4px solid #F2A93B">
          ${logo}
          <div style="color:#c8c8d8;font-family:Courier New,monospace;font-size:11px;letter-spacing:2px;margin-top:14px;text-transform:uppercase">[ 2nd edition ] &middot; AfroTech Intelligence Congress</div>
        </td></tr>
        <tr><td bgcolor="#f2f0ea" style="background-color:#f2f0ea;padding:24px;color:#0b0b12;font-family:${FONT};font-size:15px;line-height:1.55">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 24px 0;color:#8a8aa6;font-family:${FONT};font-size:11px;line-height:1.5">
          You're receiving this because you registered for ATIC 2.0 (AfroTech Intelligence Congress), organised by
          IEEE CS &middot; IIT Student Branch Chapter. Questions? Just reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

interface StudentEmailData {
  name: string;
  email: string;
  attendancePct: number;
}

function eligibleTemplate({ name, attendancePct }: StudentEmailData) {
  const subject = "Your ATIC 2.0 Certificate of Completion";
  const html = layout(`
    <h2 style="color:#2A2FE0;${H2}">Congratulations, ${escapeHtml(name)}!</h2>
    <p>Thank you for participating in <strong>ATIC 2.0 — Afrotech Intelligence Congress</strong>.</p>
    <p>You attended <strong>${attendancePct}%</strong> of the sessions, which meets our
       eligibility threshold. You are <strong>certificate-eligible</strong>.</p>
    <p>Your certificate of completion is attached / will be issued shortly.</p>
    <p style="margin-top:24px">Warm regards,<br/>The ATIC Team</p>
  `);
  const text = `Congratulations, ${name}! You attended ${attendancePct}% of sessions and are certificate-eligible. Your certificate will be issued shortly. — The ATIC Team`;
  return { subject, html, text };
}

function notEligibleTemplate({ name, attendancePct }: StudentEmailData) {
  const subject = "Thank you for attending ATIC 2.0 — Attendance summary";
  const html = layout(`
    <h2 style="color:#0b0b12;${H2}">Thank you for joining us, ${escapeHtml(name)}</h2>
    <p>We appreciate you being part of <strong>ATIC 2.0 — Afrotech Intelligence Congress</strong>.</p>
    <p>Our records show you attended <strong>${attendancePct}%</strong> of the sessions.
       Unfortunately this is below the ${eligibilityThreshold()}% threshold
       required for a certificate of completion.</p>
    <p>If you believe this is an error, please reply to this email and we'll review your attendance.</p>
    <p style="margin-top:24px">Warm regards,<br/>The ATIC Team</p>
  `);
  const text = `Thank you, ${name}. You attended ${attendancePct}% of sessions, below the required threshold for a certificate. Reply if you think this is an error. — The ATIC Team`;
  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

interface QrEmailData {
  name: string;
  email: string;
  studentId: string;
  qrToken: string;
}

/**
 * Email a student their check-in QR code, shown in the body. The image is
 * served from /q/<token>.png like the logo — inline "cid:" images were
 * listed as attachments by Gmail instead of showing in the message. Without a
 * public https base URL (local dev) it falls back to an inline attachment.
 */
export async function sendQrEmail({ name, email, studentId, qrToken }: QrEmailData) {
  const subject = "Your ATIC 2.0 check-in QR code";
  const base = publicBaseUrl();
  const qrUrl = base ? `${base}/q/${qrToken}.png` : null;
  const html = layout(`
    <h2 style="color:#2A2FE0;${H2}">Hi ${escapeHtml(name)},</h2>
    <p style="margin:0 0 16px">Here is your personal check-in QR code for <strong>ATIC 2.0 — Afrotech Intelligence Congress</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:8px 0 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:12px;border:1px solid #d9d6cc;border-radius:8px">
            <img src="${qrUrl ?? "cid:qr-code"}" alt="Your check-in QR code" width="260" height="260"
                 style="display:block;width:260px;height:260px;border:0" />
          </td></tr>
        </table>
        <div style="font-family:Courier New,monospace;font-size:13px;color:#5a5a6e;margin-top:10px">Student ID: ${escapeHtml(studentId)}</div>
      </td></tr>
    </table>
    <p style="margin:0 0 6px"><strong>Show this QR code:</strong></p>
    <ul style="margin:0 0 16px;padding-left:20px">
      <li>at the hotel check-in desk when you arrive, and</li>
      <li>at the door of every workshop session you attend (attendance counts toward your certificate).</li>
    </ul>
    <p style="margin:0 0 16px"><strong>Tips:</strong> take a screenshot of the QR code so you have it offline (if it doesn't appear, tap <em>Display images</em> at the top of this email),
       and turn your screen brightness up when it's scanned. A printed copy works too.</p>
    <p style="margin:0 0 16px;color:#b45309">This code is personal — please don't share it.</p>
    <p style="margin:24px 0 0">See you there,<br/>The ATIC Team</p>
  `);
  const text = `Hi ${name}, here is your personal check-in QR code for ATIC 2.0 (Student ID: ${studentId}). Open this email with images turned on to see it. Show it at hotel check-in and at the door of every workshop session. Save a screenshot and turn brightness up when scanning. Please don't share it. — The ATIC Team`;

  return deliver({
    to: email,
    subject,
    html,
    text,
    attachments: qrUrl
      ? undefined
      : [{ filename: "qr-code.png", content: await qrPngBuffer(qrToken), contentType: "image/png", inlineId: "qr-code" }],
  });
}

export async function sendResultEmail(data: StudentEmailData, eligible: boolean) {
  const tpl = eligible ? eligibleTemplate(data) : notEligibleTemplate(data);
  return deliver({ to: data.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
}
