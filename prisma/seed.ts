import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---- Seed admin ----
  // Only when explicitly configured — never fall back to a default password.
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  if (email && password) {
    const hash = await bcrypt.hash(password, 10);
    const existing = await prisma.admin.findUnique({ where: { email }, select: { password: true } });
    // Re-seeding with the same password keeps everyone signed in; a changed one
    // signs out devices still logged in with the old one (and clears any lock).
    const changed = existing ? !(await bcrypt.compare(password, existing.password)) : false;
    // The seeded account is the super admin: the only role that can manage
    // accounts and reset passwords. Re-seeding also repairs the role if an
    // earlier seed created it before SUPER_ADMIN existed.
    await prisma.admin.upsert({
      where: { email },
      update: changed
        ? { name, role: "SUPER_ADMIN", password: hash, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null }
        : { name, role: "SUPER_ADMIN" },
      create: { name, email, password: hash, role: "SUPER_ADMIN" },
    });
    console.log(`Super admin ready: ${email}`);
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed.");
  }

  // ---- ATIC 2.0 program (final planning, same as the congress website) ----
  // 4 parallel tracks x 3 track sessions. Times are Tunisia wall clock (UTC+1)
  // and drive the scan window, PRESENT vs LATE and the scanner's slot pre-select.
  const trackDefs = [
    "Track 1 · Cyber Security",
    "Track 2 · Artificial Intelligence",
    "Track 3 · AI in Healthcare",
    "Track 4 · IEEE",
  ];
  const slotDefs = [
    { day: 1, order: 1, label: "Session 1 · Sat 14:00", start: "2026-10-17T14:00:00+01:00", end: "2026-10-17T15:30:00+01:00" },
    { day: 1, order: 2, label: "Session 2 · Sat 16:30", start: "2026-10-17T16:30:00+01:00", end: "2026-10-17T18:00:00+01:00" },
    { day: 2, order: 3, label: "Session 3 · Sun 09:00", start: "2026-10-18T09:00:00+01:00", end: "2026-10-18T11:30:00+01:00" },
  ];
  // Who runs each track in each session ([track][session]); shown on the scanner.
  const caravan = "IEEE CS R8 AI Caravan Tunisia Team";
  const leads = [
    ["Wajih Letaief", "Mohamed Hamdi Ouerdi", "Wajih Letaief"],
    ["Imen Selmi", "Imen Selmi", "Imen Selmi"],
    [caravan, caravan, caravan],
    ["SIGHT Tunisia Section", "SIGHT Tunisia Section", "Leadership · Baya Bouchaala"],
  ];

  // Remove tracks/slots that are no longer in the program (e.g. the old
  // Track A–D placeholders) — but never anything that already holds real data.
  const staleTracks = await prisma.track.findMany({
    where: { name: { notIn: trackDefs } },
    include: { _count: { select: { slotSelections: true, currentStudents: true, scannerAdmins: true } } },
  });
  const staleSlots = await prisma.timeSlot.findMany({
    where: { label: { notIn: slotDefs.map((s) => s.label) } },
    include: { _count: { select: { slotSelections: true } } },
  });
  const staleOccWhere = {
    OR: [{ trackId: { in: staleTracks.map((t) => t.id) } }, { timeSlotId: { in: staleSlots.map((s) => s.id) } }],
  };
  const staleAttendance = await prisma.attendanceRecord.count({ where: { sessionOccurrence: staleOccWhere } });
  const inUse = [
    ...staleTracks.filter((t) => t._count.slotSelections || t._count.currentStudents || t._count.scannerAdmins).map((t) => t.name),
    ...staleSlots.filter((s) => s._count.slotSelections).map((s) => s.label),
  ];
  if (inUse.length || staleAttendance) {
    throw new Error(
      `Not removing old tracks/slots that already have scans, students or volunteers: ${inUse.join(", ") || `${staleAttendance} attendance records`}`
    );
  }
  if (staleTracks.length || staleSlots.length) {
    await prisma.sessionOccurrence.deleteMany({ where: staleOccWhere });
    await prisma.track.deleteMany({ where: { id: { in: staleTracks.map((t) => t.id) } } });
    await prisma.timeSlot.deleteMany({ where: { id: { in: staleSlots.map((s) => s.id) } } });
    console.log(`Removed old: ${[...staleTracks.map((t) => t.name), ...staleSlots.map((s) => s.label)].join(", ")}`);
  }

  const tracks = [];
  for (const tName of trackDefs) {
    tracks.push(await prisma.track.upsert({ where: { name: tName }, update: {}, create: { name: tName } }));
  }
  console.log(`Tracks ready: ${trackDefs.join(", ")}`);

  const slots = [];
  for (const s of slotDefs) {
    // label is not unique in the schema; find-or-create manually
    const data = { day: s.day, label: s.label, order: s.order, startTime: new Date(s.start), endTime: new Date(s.end) };
    const existing = await prisma.timeSlot.findFirst({ where: { label: s.label } });
    const slot = existing
      ? await prisma.timeSlot.update({ where: { id: existing.id }, data })
      : await prisma.timeSlot.create({ data });
    slots.push(slot);
    console.log(`  ${slot.label}: ${slot.startTime.toISOString()} → ${slot.endTime.toISOString()}`);
  }
  console.log(`Time slots ready: ${slots.length}`);

  // ---- A SessionOccurrence per (track, slot) ----
  for (const [si, slot] of slots.entries()) {
    for (const [ti, track] of tracks.entries()) {
      const title = `${track.name} — ${leads[ti][si]}`;
      await prisma.sessionOccurrence.upsert({
        where: { trackId_timeSlotId: { trackId: track.id, timeSlotId: slot.id } },
        update: { title },
        create: { trackId: track.id, timeSlotId: slot.id, title },
      });
    }
  }
  console.log(`Session occurrences ready.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
