import { NextRequest, NextResponse } from "next/server";
import { applyTrackChoices, secretMatches, type FormAnswer } from "@/lib/track-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/track-form — called by the Google Form's Apps Script on every
// submission (scripts/track-form.gs). No session: authenticated by the shared
// TRACK_FORM_SECRET header instead, so this path is excluded from middleware.
// body: { answers: [{ title, response }] }
export async function POST(req: NextRequest) {
  if (!process.env.TRACK_FORM_SECRET) {
    return NextResponse.json({ error: "TRACK_FORM_SECRET is not configured" }, { status: 503 });
  }
  if (!secretMatches(req.headers.get("x-track-form-secret"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const answers: FormAnswer[] = Array.isArray(body.answers)
    ? body.answers
        .filter((a: any) => a && typeof a.title === "string" && typeof a.response === "string")
        .map((a: any) => ({ title: a.title.slice(0, 300), response: a.response.slice(0, 300) }))
    : [];

  try {
    const result = await applyTrackChoices(answers);
    if (!result.ok) console.warn("track form: unmatched submission", result.error);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    console.error("track form failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
