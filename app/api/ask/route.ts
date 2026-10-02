import { supabase } from "@/lib/supabase";
import { loadKnowledge } from "@/lib/knowledge";
import { askGemini } from "@/lib/gemini";
import { dayName, todayISO, checkClosure, getMenu, checkFever, lunchCutoff } from "@/lib/tools";

export const maxDuration = 30;

type Tier = "answer" | "confirm" | "gap" | "handoff";

function nowHHMM(pinned?: string) {
  if (pinned) return pinned;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

const cite = (h: any) => `${h.title}, updated ${h.updated}`;

// Hard rules in code. A lite model can't be trusted to hold these through a prompt.
// 1. Availability is the director's call, never answered from the handbook.
const AVAILABILITY = /\b(spots?|openings?|vacanc(?:y|ies)|wait ?list|space (?:available|for))\b/i;
// 2. Routine illness is answered by the fever rule, unless something more serious is mentioned too.
const ROUTINE_ILLNESS = /\b(fever|temp|temperature|cough|cold|runny nose|pink ?eye|vomit\w*|diarrhea|sick|stomach bug|strep|come back|return to school)\b/i;
const SERIOUS = /(allerg|breath|bleed|unconscious|unresponsive|hospital|injur|hurt|bit |bite|fell|fall |hit |abuse|custody|ex |refund|charged)/i;

async function log(question: string, tier: Tier, answer: string, source: string | null, gapTheme?: string, gapStatus = "open") {
  await supabase.from("question_log").insert({ question, tier, answer, source });
  if (gapTheme) await supabase.from("gaps").insert({ question, theme: gapTheme, status: gapStatus });
}

export async function POST(req: Request) {
  const { question, today: pinnedDay, now: pinnedTime } = await req.json();
  const q = String(question ?? "").trim().slice(0, 500);
  if (!q) return Response.json({ error: "empty question" }, { status: 400 });

  const today = todayISO(pinnedDay);
  const now = nowHHMM(pinnedTime);

  let kb: Record<string, any>;
  try {
    kb = await loadKnowledge();
  } catch {
    return Response.json({ tier: "gap", answer: "I'm having trouble right now. Please call the front desk.", source: null });
  }
  const c = kb.center;

  try {
    // STEP 1: classify. The LLM only extracts; code does the deciding.
    const raw = await askGemini(
      `You classify messages from parents at a daycare front desk.
Today is ${today} (${dayName(today)}). Current time is ${now}.
Return JSON only:
{
 "intent": "hours_closures" | "tuition" | "illness" | "lunch" | "late_pickup" | "tour" | "contact" | "other",
 "sensitive": boolean,
 "sensitive_reason": string | null,
 "emergency": boolean,
 "topic": short 2-4 word label of what is being asked,
 "date": "YYYY-MM-DD" | null,
 "holiday_name": string | null,
 "temperature_f": number | null,
 "backup_lunch_request": boolean
}
Rules:
- sensitive = true ONLY for: custody or pickup authorization, injuries or incidents that already happened, anything about another child, billing disputes or refunds, abuse or safety concerns, a medical emergency happening right now, food allergies or dietary restrictions for a specific child.
- Routine illness questions are NOT sensitive. A question about a fever, cold, cough, pink eye, vomiting, or when a sick child can come back to school is intent "illness" with sensitive = false. If a temperature is mentioned, put it in temperature_f.
- emergency = true only if a child may be in medical danger right now (trouble breathing, allergic reaction, unresponsive).
- "other" = anything not about hours/closures, tuition, illness, lunch, late pickup, tours, or contact (e.g. curriculum, staff ratios, space availability).
- date: resolve "today", "tomorrow", "next Friday", or "Nov 11" to a full date. Use the next occurrence of that date after today. null if no date is involved.
- holiday_name: only when a named holiday is asked about (e.g. "Veterans Day"). Otherwise null.
- backup_lunch_request = true only if the parent is asking the center to provide a lunch because they forgot or did not pack one. A plain question about the menu is false.
Message: """${q}"""`,
      true
    );

    let cls: any;
    try { cls = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch { cls = { intent: "other", sensitive: false, topic: "unparsed question" }; }
    if (cls.date && !/^\d{4}-\d{2}-\d{2}$/.test(cls.date)) cls.date = null;

    // Hard rule 2: routine illness goes to the fever-rule path, not to a human.
    let overrides: string[] = [];
    if (cls.sensitive && !cls.emergency && ROUTINE_ILLNESS.test(q) && !SERIOUS.test(q)) {
      cls.sensitive = false;
      cls.intent = "illness";
      overrides.push("routine illness");
    }
    if (cls.intent === "illness" && typeof cls.temperature_f !== "number" && /\b(fever|temp|temperature)\b/i.test(q)) {
      const m = q.match(/\b(9[5-9]|10[0-6])(\.\d)?\b/);
      if (m) cls.temperature_f = parseFloat(m[0]);
    }

    // Hard rule 1: availability questions are never answered from the handbook.
    if (!cls.sensitive && AVAILABILITY.test(q)) {
      cls.intent = "other";
      cls.topic = "Space availability";
      overrides.push("availability");
    }

    // STEP 2: sensitive -> hand off. Hard-coded wording, never LLM-written.
    if (cls.sensitive) {
      const isAllergy = /allerg/i.test(`${cls.sensitive_reason ?? ""} ${cls.topic ?? ""} ${q}`);
      const answer = cls.emergency
        ? `If your child is in danger or having trouble breathing, call 911 now. Then call us at ${c.phone}. I've alerted ${c.director} right away.`
        : isAllergy
        ? `Thank you for flagging this. Allergies are a safety matter, so ${c.director} will confirm safe options for your child personally. ${kb.menu?.allergen_note ?? ""} Please don't rely on the posted menu for other allergens until she replies (within 2 hours during business hours). For anything urgent, call ${c.phone}.`
        : `Thank you for telling us. This needs a person, not me, so I've sent it to ${c.director}. She replies within 2 hours during business hours. If it's urgent, call ${c.phone}.`;
      await log(q, "handoff", answer, null, `Sensitive: ${cls.sensitive_reason ?? cls.topic}`, "ticket");
      return Response.json({ tier: "handoff", answer, source: null, why: { intent: cls.intent, rule: "sensitive topic, no AI answer" } });
    }

    // STEP 3: gather facts with plain code.
    let facts: any = null;
    let source: string | null = null;
    let tool = "";
    let confirm = false;

    switch (cls.intent) {
      case "hours_closures": {
        if (cls.date || cls.holiday_name) {
          const r = checkClosure(cls.date ?? today, kb.hours, kb.closures, cls.holiday_name ?? undefined);
          if (r.status !== "unknown") {
            facts = { result: r, hours: kb.hours };
            source = "Closure calendar";
            tool = "checkClosure";
          }
        } else {
          facts = { hours: kb.hours, upcoming_closures: kb.closures };
          source = cite(kb["handbook.hours_closures"]);
          tool = "hours lookup";
        }
        break;
      }
      case "tuition":
        facts = { tuition: kb.tuition, policy: kb["handbook.tuition"].body };
        source = cite(kb["handbook.tuition"]); tool = "tuition lookup";
        break;
      case "illness": {
        const t = typeof cls.temperature_f === "number" ? cls.temperature_f : null;
        facts = { rule: kb.illness_rule, policy: kb["handbook.illness"].body, temperature_check: t !== null ? checkFever(t, kb.illness_rule) : null };
        source = cite(kb["handbook.illness"]); tool = t !== null ? "checkFever" : "illness policy";
        confirm = true;
        break;
      }
      case "lunch": {
        const d = cls.date ?? today;
        const menu = getMenu(d, kb.menu);
        const cutoff = lunchCutoff(now, kb.lunch_policy);
        const closedNote = menu ? null : "The center is closed on weekends, so there is no lunch service.";
        if (cls.backup_lunch_request) {
          // Code writes the verdict. The LLM only rephrases it.
          const status = cutoff.beforeCutoff
            ? `The request came in before the ${cutoff.cutoff} cutoff, so the center can provide a backup lunch for $${cutoff.price}, billed to the family's account.`
            : `The request came in AFTER the ${cutoff.cutoff} cutoff. A backup lunch is NOT guaranteed. The center will do its best, and the director must confirm. The price is $${cutoff.price}, billed to the account.`;
          facts = { date: d, weekday: dayName(d), todays_menu: menu, backup_lunch_status: status, note: closedNote };
          confirm = !cutoff.beforeCutoff;
        } else {
          facts = { date: d, weekday: dayName(d), menu, note: closedNote };
        }
        source = cite(kb["handbook.lunch"]); tool = "getMenu + lunchCutoff";
        break;
      }
      case "late_pickup":
        facts = { rule: kb.late_pickup, policy: kb["handbook.late_pickup"].body };
        source = cite(kb["handbook.late_pickup"]); tool = "late pickup lookup";
        break;
      case "tour":
        facts = { tours: kb.tours, policy: kb["handbook.tours"].body };
        source = cite(kb["handbook.tours"]); tool = "tour lookup";
        break;
      case "contact":
        facts = { center: kb.center, policy: kb["handbook.contact"].body };
        source = cite(kb["handbook.contact"]); tool = "contact lookup";
        break;
    }

    // STEP 4: nothing supports an answer. First check answers the director has written.
    if (!facts) {
      const faqs = Object.entries(kb).filter(([k]) => k.startsWith("faq.")).map(([, v]) => v as any);
      if (faqs.length) {
        const pick = await askGemini(
          `A parent asked a daycare front desk a question. Below are answers the director already wrote. Decide whether one of them fully answers the parent's question.
Return JSON only: {"index": number | null}. Use null unless one clearly answers it.

DIRECTOR ANSWERS:
${faqs.map((f, i) => `${i}. Q: ${f.question}\n   A: ${f.answer}`).join("\n")}

PARENT'S QUESTION: """${q}"""`,
          true
        );
        let idx: number | null = null;
        try { idx = JSON.parse(pick.replace(/```json|```/g, "").trim()).index; } catch {}
        if (typeof idx === "number" && faqs[idx]) {
          const f = faqs[idx];
          const faqSource = `Director's answer, updated ${f.updated}`;
          await log(q, "answer", f.answer, faqSource);
          return Response.json({ tier: "answer", answer: f.answer, source: faqSource, why: { intent: cls.intent, tool: "director-written answer" } });
        }
      }

      // Still nothing: admit it, log the gap. Never guess.
      const answer = `I don't have that information, and I don't want to guess. I've asked ${c.director} and she replies within 2 hours during business hours. You can also call ${c.phone}.`;
      await log(q, "gap", answer, null, cls.topic ?? "unknown");
      return Response.json({ tier: "gap", answer, source: null, why: { intent: cls.intent, rule: "no supporting source found", overrides } });
    }

    // STEP 5: write the answer from the facts only.
    const answer = (await askGemini(
      `You are the front desk assistant for ${c.name}. Write a reply to a parent.
Use ONLY the FACTS below. If a detail is not in FACTS, do not state it.
If FACTS contain backup_lunch_status, repeat its conclusion faithfully. Never say a lunch can be provided unless that status says so.
Style: warm, plain words, 2 to 4 sentences. Open with a brief, natural acknowledgement, but do not restate the parent's question (never start with "I understand you want to know"). Then give the answer.
Always include the weekday with any date (e.g. "Wednesday, Nov 11").
${confirm ? `End by offering to ping ${c.director} to confirm for their situation.` : "Do not offer to contact anyone unless FACTS say to."}
Do not mention FACTS or sources in the reply.

FACTS:
${JSON.stringify(facts, null, 2)}

PARENT'S QUESTION: """${q}"""`
    )).trim();

    const tier: Tier = confirm ? "confirm" : "answer";
    await log(q, tier, answer, source);
    return Response.json({ tier, answer, source, why: { intent: cls.intent, tool, overrides } });
  } catch (e) {
    // STEP 6: Gemini down or anything else failed. Never show a raw error.
    console.error("ASK ERROR:", e);
    const answer = `I'm having trouble right now, so I've let ${c.director} know. You can also call ${c.phone}.`;
    await log(q, "gap", answer, null, "System error").catch(() => {});
    return Response.json({ tier: "gap", answer, source: null, why: { rule: "system error" } });
  }
}
