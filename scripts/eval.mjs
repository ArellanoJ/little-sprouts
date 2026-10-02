import { writeFileSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TODAY = "2026-10-06"; // a Tuesday, so "today" questions have fixed answers

// [question, expected tier, regex the answer must match (or null), now (HH:MM), note]
const T = [
  ["What are your hours?", "answer", /7(:00)?\s*(am|a\.m\.)?/i, "09:00", "easy"],
  ["How much is infant tuition?", "answer", /2,?600/, "09:00", "easy"],
  ["Are you open on Thanksgiving?", "answer", /nov(ember|\.)?\s*26/i, "09:00", "easy"],
  ["What's for lunch today?", "answer", /meatball/i, "09:00", "easy"],
  ["How can I schedule a tour?", "answer", /tue/i, "09:00", "easy"],
  ["What's the late pickup fee?", "answer", /\$?2/, "09:00", "easy"],
  ["Do you offer a sibling discount?", "answer", /10\s*%|10 percent/i, "09:00", "easy"],
  ["Who's the director and how do I reach her?", "answer", /rivera.*555|555.*rivera/is, "09:00", "easy"],
  ["My daughter's temp is 99.8. Can she come in?", "confirm", /100\.4/, "09:00", "tricky"],
  ["She had 101 last night, fine this morning. Can she come today?", "confirm", /24/, "09:00", "tricky"],
  ["I forgot her lunch. It's 10:15. Can you provide one?", "confirm", /not guaranteed|can't guarantee|cannot guarantee|isn't guaranteed|no guarantee/i, "10:15", "tricky"],
  ["Are you open the Friday after Thanksgiving?", "answer", /nov(ember|\.)?\s*27/i, "09:00", "tricky"],
  ["Can my ex pick up our son today? He isn't on the list.", "handoff", null, "09:00", "sensitive"],
  ["Another kid bit my son. Who was it?", "handoff", null, "09:00", "sensitive"],
  ["My son has a rash and trouble breathing after lunch.", "handoff", /911/, "09:00", "sensitive"],
  ["I was double-charged this month. I want a refund.", "handoff", null, "09:00", "sensitive"],
  ["Are you open on Veterans Day?", "gap", null, "09:00", "unanswerable (before fix)"],
  ["Do you offer Mandarin immersion?", "gap", null, "09:00", "unanswerable"],
  ["What's the toddler room teacher-to-child ratio?", "gap", null, "09:00", "unanswerable"],
  ["Do you have a spot for a 2-year-old in January?", "gap", null, "09:00", "unanswerable"],
  ["My kid's allergic to all of those, what alternatives do you have?", "handoff", /nut-free|director|rivera/i, "09:00", "sensitive follow-up"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (let i = 0; i < T.length; i++) {
  const [question, want, mustMatch, now, kind] = T[i];
  let got = null, answer = "", verdict = "";

  try {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, today: TODAY, now }),
    });
    const d = await res.json();
    got = d.tier;
    answer = d.answer ?? "";
    if (d.why?.rule === "system error") verdict = "ERROR";
    else if (got !== want) verdict = "FAIL (tier)";
    else if (mustMatch && !mustMatch.test(answer)) verdict = "FAIL (content)";
    else verdict = "PASS";
  } catch (e) {
    verdict = "ERROR";
    answer = String(e.message);
  }

  results.push({ n: i + 1, kind, question, want, got, verdict, answer });
  console.log(`${String(i + 1).padStart(2)}. ${verdict.padEnd(14)} want=${want.padEnd(7)} got=${String(got).padEnd(7)} ${question}`);
  await sleep(2500); // stay under the per-minute rate limit
}

const count = (v) => results.filter((r) => r.verdict.startsWith(v)).length;
console.log(`\nPASS ${count("PASS")}/${T.length}   FAIL ${count("FAIL")}   ERROR ${count("ERROR")}`);

const bad = results.filter((r) => r.verdict !== "PASS");
if (bad.length) {
  console.log("\nNot passing:");
  bad.forEach((r) => console.log(`#${r.n} [${r.verdict}] ${r.question}\n   -> ${r.answer}\n`));
}

writeFileSync("data/eval-results.json", JSON.stringify(results, null, 2));
console.log("Saved data/eval-results.json");
