import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

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
    const name = configured?.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() || "Event Team";
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

interface StudentEmailData {
  name: string;
  email: string;
  attendancePct: number;
}

function eligibleTemplate({ name, attendancePct }: StudentEmailData) {
  const subject = "🎉 Your Certificate of Completion";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="color:#0f766e">Congratulations, ${escapeHtml(name)}!</h2>
    <p>Thank you for participating in our 2-day workshop event.</p>
    <p>You attended <strong>${attendancePct}%</strong> of the sessions, which meets our
       eligibility threshold. You are <strong>certificate-eligible</strong>.</p>
    <p>Your certificate of completion is attached / will be issued shortly.</p>
    <p style="margin-top:24px">Warm regards,<br/>The Event Team</p>
  </div>`;
  const text = `Congratulations, ${name}! You attended ${attendancePct}% of sessions and are certificate-eligible. Your certificate will be issued shortly. — The Event Team`;
  return { subject, html, text };
}

function notEligibleTemplate({ name, attendancePct }: StudentEmailData) {
  const subject = "Thank you for attending — Attendance summary";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="color:#b45309">Thank you for joining us, ${escapeHtml(name)}</h2>
    <p>We appreciate you being part of our 2-day workshop event.</p>
    <p>Our records show you attended <strong>${attendancePct}%</strong> of the sessions.
       Unfortunately this is below the ${process.env.ELIGIBILITY_THRESHOLD ?? 70}% threshold
       required for a certificate of completion.</p>
    <p>If you believe this is an error, please reply to this email and we'll review your attendance.</p>
    <p style="margin-top:24px">Warm regards,<br/>The Event Team</p>
  </div>`;
  const text = `Thank you, ${name}. You attended ${attendancePct}% of sessions, below the required threshold for a certificate. Reply if you think this is an error. — The Event Team`;
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
  qrPng: Buffer;
}

/**
 * Email a student their check-in QR code: shown inline in the body (cid:) and
 * also attached as a PNG so it can be saved to the phone's photos.
 */
export async function sendQrEmail({ name, email, studentId, qrPng }: QrEmailData) {
  const subject = "Your event check-in QR code";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="color:#0f766e">Hi ${escapeHtml(name)},</h2>
    <p>Here is your personal QR code for the 2-day workshop event.</p>
    <div style="text-align:center;margin:24px 0">
      <img src="cid:qr-code" alt="Your check-in QR code" width="280" height="280"
           style="width:280px;height:280px;border:1px solid #e2e8f0;border-radius:8px" />
      <div style="font-size:13px;color:#64748b;margin-top:8px">Student ID: ${escapeHtml(studentId)}</div>
    </div>
    <p><strong>Show this QR code:</strong></p>
    <ul>
      <li>at the hotel check-in desk when you arrive, and</li>
      <li>at the door of every workshop session you attend (attendance counts toward your certificate).</li>
    </ul>
    <p><strong>Tips:</strong> save the attached image to your phone's photos so you have it offline,
       and turn your screen brightness up when it's scanned. A printed copy works too.</p>
    <p style="color:#b45309">This code is personal — please don't share it.</p>
    <p style="margin-top:24px">See you there,<br/>The Event Team</p>
  </div>`;
  const text = `Hi ${name}, your personal check-in QR code for the workshop event is attached (Student ID: ${studentId}). Show it at hotel check-in and at the door of every workshop session. Save it to your phone and turn brightness up when scanning. Please don't share it. — The Event Team`;

  const safeId = studentId.replace(/[^a-z0-9_-]+/gi, "_");
  return deliver({
    to: email,
    subject,
    html,
    text,
    attachments: [
      { filename: "qr-code.png", content: qrPng, contentType: "image/png", inlineId: "qr-code" },
      { filename: `checkin-qr-${safeId}.png`, content: qrPng, contentType: "image/png" },
    ],
  });
}

export async function sendResultEmail(data: StudentEmailData, eligible: boolean) {
  const tpl = eligible ? eligibleTemplate(data) : notEligibleTemplate(data);
  return deliver({ to: data.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
}
