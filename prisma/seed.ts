import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---- Seed admin ----
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@yourdomain.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  const hash = await bcrypt.hash(password, 10);
  await prisma.admin.upsert({
    where: { email },
    update: { name, password: hash },
    create: { name, email, password: hash },
  });
  console.log(`Admin ready: ${email}`);

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
  const base = new Date("2026-01-01T00:00:00Z");
  const slotDefs = [
    { day: 1, label: "Day 1 - Morning", order: 1, sh: 9, eh: 12 },
    { day: 1, label: "Day 1 - Afternoon", order: 2, sh: 13, eh: 16 },
    { day: 2, label: "Day 2 - Morning", order: 3, sh: 9, eh: 12 },
    { day: 2, label: "Day 2 - Afternoon", order: 4, sh: 13, eh: 16 },
  ];

  const slots = [];
  for (const s of slotDefs) {
    // upsert-by-label is not unique in schema; find-or-create manually
    let slot = await prisma.timeSlot.findFirst({ where: { label: s.label } });
    if (!slot) {
      const start = new Date(base);
      start.setUTCDate(base.getUTCDate() + (s.day - 1));
      start.setUTCHours(s.sh, 0, 0, 0);
      const end = new Date(start);
      end.setUTCHours(s.eh, 0, 0, 0);
      slot = await prisma.timeSlot.create({
        data: { day: s.day, label: s.label, startTime: start, endTime: end, order: s.order },
      });
    }
    slots.push(slot);
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
