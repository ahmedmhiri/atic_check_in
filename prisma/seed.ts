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
    await prisma.admin.upsert({
      where: { email },
      update: { name, password: hash },
      create: { name, email, password: hash },
    });
    console.log(`Admin ready: ${email}`);
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed.");
  }

  // ---- Seed 4 parallel workshop tracks ----
  const trackNames = ["Track A", "Track B", "Track C", "Track D"];
  const tracks = [];
  for (const tName of trackNames) {
    const t = await prisma.track.upsert({
      where: { name: tName },
      update: {},
      create: { name: tName },
    });
    tracks.push(t);
  }
  console.log(`Tracks ready: ${trackNames.join(", ")}`);

  // ---- Seed time slots (2 days x 2 slots = 4 total) ----
  // Times are wall-clock hours at the venue. EVENT_DAY1_DATE (YYYY-MM-DD) and
  // EVENT_UTC_OFFSET (e.g. +01:00) pin them to real instants; LATE detection
  // depends on these being correct. When set, existing slots are updated too.
  const day1 = process.env.EVENT_DAY1_DATE;
  const offset = process.env.EVENT_UTC_OFFSET ?? "+00:00";
  if (day1 && !/^\d{4}-\d{2}-\d{2}$/.test(day1)) throw new Error(`EVENT_DAY1_DATE must be YYYY-MM-DD, got "${day1}"`);
  if (!/^[+-]\d{2}:\d{2}$/.test(offset)) throw new Error(`EVENT_UTC_OFFSET must look like +01:00, got "${offset}"`);
  if (!day1) console.warn("EVENT_DAY1_DATE not set — new slots get placeholder dates and existing slot times are left untouched.");

  const slotInstant = (day: number, hour: number) => {
    const d = new Date(`${day1 ?? "2026-01-01"}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (day - 1));
    const date = d.toISOString().slice(0, 10);
    const t = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00${day1 ? offset : "Z"}`);
    if (isNaN(t.getTime())) throw new Error(`Invalid slot time for day ${day} ${hour}:00`);
    return t;
  };
  const slotDefs = [
    { day: 1, label: "Day 1 - Morning", order: 1, sh: 9, eh: 12 },
    { day: 1, label: "Day 1 - Afternoon", order: 2, sh: 13, eh: 16 },
    { day: 2, label: "Day 2 - Morning", order: 3, sh: 9, eh: 12 },
    { day: 2, label: "Day 2 - Afternoon", order: 4, sh: 13, eh: 16 },
  ];

  const slots = [];
  for (const s of slotDefs) {
    // upsert-by-label is not unique in schema; find-or-create manually
    const startTime = slotInstant(s.day, s.sh);
    const endTime = slotInstant(s.day, s.eh);
    let slot = await prisma.timeSlot.findFirst({ where: { label: s.label } });
    if (!slot) {
      slot = await prisma.timeSlot.create({
        data: { day: s.day, label: s.label, startTime, endTime, order: s.order },
      });
    } else if (day1) {
      slot = await prisma.timeSlot.update({ where: { id: slot.id }, data: { startTime, endTime } });
    }
    slots.push(slot);
    console.log(`  ${slot.label}: ${slot.startTime.toISOString()} → ${slot.endTime.toISOString()}`);
  }
  console.log(`Time slots ready: ${slots.length}`);

  // ---- Seed a SessionOccurrence per (track, slot) ----
  for (const slot of slots) {
    for (const track of tracks) {
      await prisma.sessionOccurrence.upsert({
        where: { trackId_timeSlotId: { trackId: track.id, timeSlotId: slot.id } },
        update: {},
        create: {
          trackId: track.id,
          timeSlotId: slot.id,
          title: `${track.name} — ${slot.label}`,
        },
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
