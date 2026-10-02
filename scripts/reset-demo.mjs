import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import ws from "ws";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

const seed = JSON.parse(readFileSync("data/seed.json", "utf8"));
const D = "Maria Rivera";
const P = "(206) 555-0142";
const GAP = `I don't have that information, and I don't want to guess. I've asked ${D} and she replies within 2 hours during business hours. You can also call ${P}.`;
const HAND = `Thank you for telling us. This needs a person, not me, so I've sent it to ${D}. She replies within 2 hours during business hours. If it's urgent, call ${P}.`;
const EMERG = `If your child is in danger or having trouble breathing, call 911 now. Then call us at ${P}. I've alerted ${D} right away.`;

const HRS = "Hours & Closures, updated Sep 2026";
const TUI = "Tuition & Billing, updated Sep 2026";
const MEAL = "Meals & Lunch Policy, updated Sep 2026";
const LATE = "Late Pickup Policy, updated Sep 2026";
const TOUR = "Tours & Enrollment, updated Sep 2026";
const CONT = "Contact & Escalation, updated Sep 2026";
const ILL = "Illness Policy, updated Sep 2026";
const CAL = "Closure calendar";

// [daysAgo, hour, tier, question, answer, source, gapTheme]
const rows = [
  [6, 8, "answer", "What are your hours?", "We're open Monday to Friday, 7:00 AM to 6:00 PM.", HRS],
  [6, 9, "answer", "How much is infant tuition?", "Infant tuition (6 weeks to 12 months) is $2,600 per month, billed on the 1st.", TUI],
  [5, 7, "answer", "Are you open on Thanksgiving?", "We're closed Thursday, Nov 26, and Friday, Nov 27. We reopen Monday, Nov 30.", CAL],
  [5, 10, "answer", "What's for lunch today?", "Today's lunch is turkey meatballs, pasta, and green beans.", MEAL],
  [5, 15, "answer", "Do you offer a sibling discount?", "Yes, siblings get 10% off the lower tuition.", TUI],
  [4, 8, "answer", "What's the late pickup fee?", "There's a 5-minute grace period, then $2 per minute.", LATE],
  [4, 12, "answer", "How do I schedule a tour?", "Tours run Tuesdays and Thursdays at 10:00, 11:00, and 2:00. Maria confirms openings directly.", TOUR],
  [4, 16, "answer", "Who is the director?", `${D}. You can reach her at ${P}.`, CONT],
  [3, 9, "answer", "Are you open Christmas Eve?", "We're closed Thursday, Dec 24.", CAL],
  [3, 11, "answer", "What time do you close?", "We close at 6:00 PM, Monday to Friday.", HRS],
  [3, 17, "answer", "How much is toddler care?", "Toddler tuition (12 to 24 months) is $2,350 per month.", TUI],
  [2, 8, "answer", "Are you open on MLK Day?", "We're closed Monday, Jan 18.", CAL],
  [2, 13, "answer", "What's for lunch on Wednesday?", "Wednesday's lunch is a veggie quesadilla with black beans and corn.", MEAL],
  [1, 9, "answer", "What is preschool tuition?", "Preschool tuition (3 to 5 years) is $1,850 per month.", TUI],

  [3, 7, "confirm", "My daughter has a temp of 99.8, can she come in?", `Thanks for letting us know. 99.8°F is under our 100.4°F limit, so she can come in if she's feeling well. Want me to ping ${D} to confirm for your situation?`, ILL],
  [2, 6, "confirm", "She had 101 last night, fine this morning. Can she come today?", `Thanks for checking. She needs to be fever-free for 24 hours without fever-reducing medicine before she returns. Want me to ping ${D} to confirm for your situation?`, ILL],
  [1, 10, "confirm", "I forgot her lunch, can you provide one?", `No worries! It's past our 9:00 AM cutoff, so a $6 backup lunch isn't guaranteed. Want me to ping ${D} to confirm for your situation?`, MEAL],

  [6, 17, "gap", "Are you open on Veterans Day?", GAP, null, "Veterans Day closure"],
  [3, 18, "gap", "Is the center closed for Veterans Day?", GAP, null, "Veterans Day closure"],
  [1, 8, "gap", "Veterans Day, open or closed?", GAP, null, "Veterans Day closure"],
  [5, 19, "gap", "Do you offer Mandarin immersion?", GAP, null, "Mandarin immersion"],
  [2, 20, "gap", "Is there a Mandarin program for preschoolers?", GAP, null, "Mandarin immersion"],
  [4, 14, "gap", "What's the toddler room teacher-to-child ratio?", GAP, null, "Staff ratios"],
  [1, 19, "gap", "Do you have a spot for a 2-year-old in January?", GAP, null, "Space availability"],

  [5, 8, "handoff", "Can my ex pick up our son today? He isn't on the list.", HAND, null, "Sensitive: pickup authorization"],
  [4, 9, "handoff", "Another kid bit my son. Who was it?", HAND, null, "Sensitive: incident, other child"],
  [2, 11, "handoff", "My son has a rash and trouble breathing after lunch", EMERG, null, "Sensitive: medical emergency"],
  [3, 15, "handoff", "I was double-charged this month. I want a refund.", HAND, null, "Sensitive: billing dispute"],
];

const when = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const fail = (label, error) => {
  if (error) { console.log(`FAILED (${label}): ${error.message}`); process.exit(1); }
};

// 1. Wipe logs, gaps, and any director-written answers.
fail("clear log", (await supabase.from("question_log").delete().gte("id", 0)).error);
fail("clear gaps", (await supabase.from("gaps").delete().gte("id", 0)).error);
fail("clear faq", (await supabase.from("knowledge").delete().like("key", "faq.%")).error);

// 2. Restore original closures (no Veterans Day).
fail("closures", (await supabase.from("knowledge").upsert(
  { key: "closures", value: seed.closures, updated_at: new Date().toISOString() },
  { onConflict: "key" }
)).error);

// 3. Load demo history.
const logRows = rows.map(([d, h, tier, question, answer, source]) => ({
  question, tier, answer, source, created_at: when(d, h),
}));
fail("insert log", (await supabase.from("question_log").insert(logRows)).error);

const gapRows = rows
  .filter((r) => r[6])
  .map(([d, h, tier, question, , , theme]) => ({
    question, theme, status: tier === "handoff" ? "ticket" : "open", created_at: when(d, h),
  }));
fail("insert gaps", (await supabase.from("gaps").insert(gapRows)).error);

console.log(`Demo reset: ${logRows.length} log rows, ${gapRows.length} gaps/tickets.`);
