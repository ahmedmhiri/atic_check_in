/**
 * ATIC 2.0 — "Choose your track" Google Form + webhook to the check-in app.
 *
 * Setup (once):
 *   1. https://script.google.com → New project → paste this file.
 *   2. Set SECRET below to the TRACK_FORM_SECRET value in Vercel.
 *   3. Run `setup` and allow the permissions it asks for. It creates the form,
 *      installs the on-submit trigger and logs two links:
 *        - the form's edit link (for organisers), and
 *        - TRACK_FORM_URL, the pre-filled link to put in Vercel.
 *
 * Already ran the old version (one question per session)? Paste this file over
 * it (keep your SECRET line) and run `switchToOneTrack` once instead of setup.
 *
 * Every submission (and every edit of one) is posted to /api/track-form, which
 * locks the student to the chosen track for all 3 sessions. Question titles
 * must keep starting with "Email", "Personal code" and "Track", and answers
 * with "Track N" — that's how the app reads them.
 */

const APP_URL = "https://atic-check-in.vercel.app";
const SECRET = "PASTE_TRACK_FORM_SECRET_HERE";

const TRACKS = [
  "Track 1 · Cyber Security — Workshop Room 1",
  "Track 2 · Artificial Intelligence — Workshop Room 2",
  "Track 3 · AI in Healthcare — Workshop Room 3",
  "Track 4 · IEEE — Conference Room",
];

const TRACK_HELP =
  "You follow the track you pick for all 3 track sessions (Sat 17 Oct 14:00–15:30, Sat 16:30–18:00, Sun 18 Oct 09:00–11:30).\n" +
  "Track 1 — Wajih Letaief, Mohamed Hamdi Ouerdi, Wajih Letaief\n" +
  "Track 2 — Imen Selmi (all 3 sessions)\n" +
  "Track 3 — IEEE CS R8 AI Caravan Tunisia Team (all 3 sessions)\n" +
  "Track 4 — SIGHT Tunisia Section, SIGHT Tunisia Section, Leadership with Baya Bouchaala";

const DESCRIPTION =
  "Pick one track — you follow it for all 3 track sessions.\n\n" +
  "Your choice is binding: you'll only be scanned in at the door of the track you chose. " +
  "You can edit your answer until 30 minutes before session 1 (Saturday 13:30) — after that it's final.\n\n" +
  "Open this form from the link in your ATIC email so your email and personal code are filled in.";

function addTrackQuestion(form) {
  return form.addMultipleChoiceItem().setTitle("Track").setHelpText(TRACK_HELP).setChoiceValues(TRACKS).setRequired(true);
}

function setup() {
  const form = FormApp.create("ATIC 2.0 — Choose your track");
  form
    .setDescription(DESCRIPTION)
    .setAllowResponseEdits(true)
    .setConfirmationMessage("Thanks — your track is saved. See you at the door with your QR code!");

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
  addTrackQuestion(form);

  ScriptApp.newTrigger("onSubmit").forForm(form).onFormSubmit().create();

  const prefilled = form
    .createResponse()
    .withItemResponse(email.createResponse("__EMAIL__"))
    .withItemResponse(code.createResponse("__CODE__"))
    .toPrefilledUrl();

  console.log("Form edit link: " + form.getEditUrl());
  console.log("TRACK_FORM_URL=" + prefilled);
}

/**
 * One-off: turn the form `setup` already made (3 "Session N" questions) into
 * the single "Track" question. Email and code questions are kept, so the
 * TRACK_FORM_URL already in Vercel keeps working.
 */
function switchToOneTrack() {
  const trigger = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === "onSubmit";
  })[0];
  if (!trigger) throw new Error("No onSubmit trigger — run setup instead.");
  const form = FormApp.openById(trigger.getTriggerSourceId());

  form.getItems().forEach(function (item) {
    if (/^session\s*\d/i.test(item.getTitle())) form.deleteItem(item);
  });
  if (!form.getItems().some(function (item) { return item.getTitle() === "Track"; })) addTrackQuestion(form);

  form
    .setTitle("ATIC 2.0 — Choose your track")
    .setDescription(DESCRIPTION)
    .setConfirmationMessage("Thanks — your track is saved. See you at the door with your QR code!");
  console.log("Updated: " + form.getEditUrl());
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
