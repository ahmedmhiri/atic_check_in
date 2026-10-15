/**
 * ATIC 2.0 — "Choose your tracks" Google Form + webhook to the check-in app.
 *
 * Setup (once):
 *   1. https://script.google.com → New project → paste this file.
 *   2. Set SECRET below to the TRACK_FORM_SECRET value in Vercel.
 *   3. Run `setup` and allow the permissions it asks for. It creates the form,
 *      installs the on-submit trigger and logs two links:
 *        - the form's edit link (for organisers), and
 *        - TRACK_FORM_URL, the pre-filled link to put in Vercel.
 *
 * Every submission (and every edit of one) is posted to /api/track-form, which
 * locks the student to the chosen track for each session. Question titles must
 * keep starting with "Email", "Personal code" and "Session N", and answers with
 * "Track N" — that's how the app reads them.
 */

const APP_URL = "https://atic-check-in.vercel.app";
const SECRET = "PASTE_TRACK_FORM_SECRET_HERE";

const T1 = "Track 1 · Cyber Security";
const T2 = "Track 2 · Artificial Intelligence";
const T3 = "Track 3 · AI in Healthcare";
const T4 = "Track 4 · IEEE";
const CARAVAN = "IEEE CS R8 AI Caravan Tunisia Team";

const SESSIONS = [
  {
    title: "Session 1 — Saturday 17 Oct, 14:00–15:30",
    options: [
      `${T1} — Wajih Letaief (Workshop Room 1)`,
      `${T2} — Imen Selmi (Workshop Room 2)`,
      `${T3} — ${CARAVAN} (Workshop Room 3)`,
      `${T4} — SIGHT Tunisia Section (Conference Room)`,
    ],
  },
  {
    title: "Session 2 — Saturday 17 Oct, 16:30–18:00",
    options: [
      `${T1} — Mohamed Hamdi Ouerdi (Workshop Room 1)`,
      `${T2} — Imen Selmi (Workshop Room 2)`,
      `${T3} — ${CARAVAN} (Workshop Room 3)`,
      `${T4} — SIGHT Tunisia Section (Conference Room)`,
    ],
  },
  {
    title: "Session 3 — Sunday 18 Oct, 09:00–11:30",
    options: [
      `${T1} — Wajih Letaief (Workshop Room 1)`,
      `${T2} — Imen Selmi (Workshop Room 2)`,
      `${T3} — ${CARAVAN} (Workshop Room 3)`,
      `${T4} Leadership — Baya Bouchaala (Conference Room)`,
    ],
  },
];

function setup() {
  const form = FormApp.create("ATIC 2.0 — Choose your tracks");
  form
    .setDescription(
      "Pick one track for each of the 3 track sessions.\n\n" +
        "Your choice is binding: at each session you'll only be scanned in at the door of the track you chose. " +
        "You can edit your answer until 30 minutes before each session starts — after that it's final.\n\n" +
        "Open this form from the link in your ATIC email so your email and personal code are filled in."
    )
    .setAllowResponseEdits(true)
    .setConfirmationMessage("Thanks — your tracks are saved. See you at the door with your QR code!");

  const email = form
    .addTextItem()
    .setTitle("Email")
    .setHelpText("Filled in from your ATIC email link — please don't change it.")
    .setRequired(true);
  const code = form
    .addTextItem()
    .setTitle("Personal code")
    .setHelpText("Filled in from your ATIC email link — please don't change it.")
    .setRequired(true);
  for (const s of SESSIONS) {
    form.addMultipleChoiceItem().setTitle(s.title).setChoiceValues(s.options).setRequired(true);
  }

  ScriptApp.newTrigger("onSubmit").forForm(form).onFormSubmit().create();

  const prefilled = form
    .createResponse()
    .withItemResponse(email.createResponse("__EMAIL__"))
    .withItemResponse(code.createResponse("__CODE__"))
    .toPrefilledUrl();

  console.log("Form edit link: " + form.getEditUrl());
  console.log("TRACK_FORM_URL=" + prefilled);
}

function onSubmit(e) {
  const answers = e.response.getItemResponses().map(function (r) {
    return { title: r.getItem().getTitle(), response: String(r.getResponse()) };
  });
  const res = UrlFetchApp.fetch(APP_URL + "/api/track-form", {
    method: "post",
    contentType: "application/json",
    headers: { "x-track-form-secret": SECRET },
    payload: JSON.stringify({ answers: answers }),
    muteHttpExceptions: true,
  });
  console.log(res.getResponseCode() + " " + res.getContentText());
}
