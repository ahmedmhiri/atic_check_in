// ATIC 2.0 program, from the final planning (same as the congress website).
// Shown in the event-day email. Track sessions themselves live in the DB
// (prisma/seed.ts) and in the Google Form (scripts/track-form.gs).

export const venue = "El Ksar Resort & Thalasso, Sousse";

export const program: { day: string; items: { time: string; title: string; where?: string; tracks?: boolean }[] }[] = [
  {
    day: "Saturday 17 October",
    items: [
      { time: "08:00 – 10:00", title: "Registration & event check-in", where: "Hotel" },
      { time: "10:00 – 11:30", title: "Opening ceremony & keynote — Ernesto Damiani", where: "Conference Room" },
      { time: "11:30 – 12:30", title: "Panel: AI vs Cybersecurity", where: "Conference Room" },
      { time: "12:00 – 13:00", title: "Hotel check-in", where: "Hotel" },
      { time: "13:00 – 14:00", title: "Lunch", where: "Hotel" },
      { time: "14:00 – 15:30", title: "Track session 1", tracks: true },
      { time: "15:40 – 16:20", title: "Round table", where: "Conference Room" },
      { time: "16:30 – 18:00", title: "Track session 2", tracks: true },
      { time: "18:10 – 19:00", title: "Nano mentoring // Industrial booths", where: "Conference Room · Hotel" },
      { time: "20:00 – 21:00", title: "Dinner", where: "Hotel" },
      { time: "22:00 – 00:00", title: "Surprise challenge + multicultural night", where: "Conference Room" },
    ],
  },
  {
    day: "Sunday 18 October",
    items: [
      { time: "07:00 – 09:00", title: "Breakfast", where: "Hotel" },
      { time: "09:00 – 11:30", title: "Track session 3", tracks: true },
      { time: "11:30 – 12:00", title: "Coffee break & hotel check-out", where: "Hotel" },
      { time: "12:30", title: "Closing ceremony — track outcomes & certificates", where: "Conference Room" },
    ],
  },
];

export const trackRooms = [
  "Track 1 · Cyber Security — Workshop Room 1",
  "Track 2 · Artificial Intelligence — Workshop Room 2",
  "Track 3 · AI in Healthcare (AI Caravan) — Workshop Room 3",
  "Track 4 · IEEE (Sunday: IEEE Leadership) — Conference Room",
];
