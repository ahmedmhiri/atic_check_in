# Event Attendance (Admin-only)

Next.js 14 (App Router) + TypeScript admin tool for a 2-day, 4-track workshop event.
Hotel check-in → per-slot workshop check-in → finalize & email certificates.

## Stack
- Next.js 14 App Router, TypeScript, Tailwind
- Prisma + PostgreSQL (Supabase)
- NextAuth (credentials, JWT) — single admin role, all routes protected via `middleware.ts`
- `qrcode` (generation) + `html5-qrcode` (in-browser scanning)
- `xlsx` (spreadsheet import) + `jszip` (QR ZIP export)
- Resend (certificate / notice emails)

## Setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, RESEND_API_KEY, EMAIL_FROM, SEED_ADMIN_*
npm run db:push               # create tables in Supabase
npm run db:seed               # create admin + 4 tracks + 4 time slots + session occurrences
npm run dev
```

Open http://localhost:3000 → sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Flow
1. **Import** (`/import`): upload `.xlsx`/`.csv` (columns `name`, `email`, `studentId`). QR tokens auto-generated; duplicates skipped. Download all QR codes as a ZIP.
2. **Hotel scan** (`/scan/hotel`): scan a badge → idempotent hotel check-in, live arrivals counter.
3. **Workshop scan** (`/scan/[trackId]`): pick the active time slot, then scan.
   - Requires hotel check-in first.
   - First scan in a slot locks the student to that track *for that slot only* and sets `currentTrackId`.
   - Re-scan same session → "already scanned". Scan at a different track same slot → rejected.
   - **Start New Time Slot** button resets every `currentTrackId` to null (students free to re-choose).
4. **Dashboard** (`/`): totals, hotel counts, live per-track occupancy, per-student drill-down (`/students/[id]`) with slot-by-slot history + manual override.
5. **Finalize** (dashboard button → `/api/finalize`): attendance % = attended / total time slots. ≥ threshold → certificate email, else not-eligible notice. Rate-limited (~1.6/s) with retry + per-student log.

## API
- `POST /api/import` — spreadsheet import
- `GET  /api/qr` — ZIP of QR PNGs
- `POST /api/checkin/hotel` — hotel check-in
- `POST /api/checkin/[trackId]` — workshop check-in (`{ qrToken, timeSlotId, sessionOccurrenceId }`)
- `POST /api/timeslots/reset` — reset `currentTrackId` (new slot begins)
- `GET  /api/timeslots` — slots + session occurrences
- `POST /api/override` — manual corrections (`reassignSlot`/`addAttendance`/`deleteAttendance`/`setHotel`)
- `POST /api/finalize` — compute % + send emails
- `GET  /api/stats` — live overview numbers

## Notes
- Track-specific scanner admins: set `Admin.assignedTrackId`. The value flows into the JWT/session; add a per-track guard in `/api/checkin/[trackId]` if you want to hard-restrict scanners to their track.
- Supabase: use the **pooled** URL (`6543`, `pgbouncer=true`) for `DATABASE_URL` and the **direct** URL (`5432`) for `DIRECT_URL`.
- `LATE` vs `PRESENT` is decided by a 15-minute grace after the slot's `startTime` (adjust `GRACE_MINUTES`). Admins can override any record.
