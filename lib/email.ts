import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Event Team <onboarding@resend.dev>";

// Lazily construct the client so an unset key doesn't crash at import/build time.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — cannot send emails.");
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
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

export async function sendResultEmail(data: StudentEmailData, eligible: boolean) {
  const tpl = eligible ? eligibleTemplate(data) : notEligibleTemplate(data);
  const { data: res, error } = await getResend().emails.send({
    from: FROM,
    to: data.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  if (error) throw new Error(error.message ?? "Resend send failed");
  return res?.id;
}
