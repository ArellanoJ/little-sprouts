# AI Front Desk for Little Sprouts Early Learning

A prototype AI front desk for a fictional daycare. Parents ask questions in a mobile chat, and the center's director gets a control center that shows where the assistant struggled and lets her fix it in one step. All data is invented.

**Live:** https://little-sprouts-delta.vercel.app (parent chat at `/parent`, control center at `/admin`)

## How it works

Most front-desk questions are policy logic, not document search. So code decides every fact and the LLM only reads the question and words the reply.

1. A classifier call returns JSON: topic, whether the message is sensitive, and any date, holiday name, or temperature.
2. Sensitive topics (custody, injuries, allergies, billing, emergencies) skip the answer step. They get fixed wording and a ticket, with 911 first for emergencies.
3. Fact questions call plain functions in `lib/tools.ts` (closure calendar, menu, fever rule, lunch cutoff) or load the matching handbook section.
4. A second call words the reply from only those facts.
5. If nothing supports an answer, the assistant says so and logs a gap instead of guessing.

A named holiday that is not on file returns "unknown," not "open," which is what makes the gap real.

## Layout

- `app/parent/page.tsx`: parent chat
- `app/admin/page.tsx`: control center (gaps inbox, question log, knowledge editor, metrics)
- `app/api/ask/route.ts`: the pipeline above
- `app/api/admin/*`: data, save, and resolve routes for the control center
- `lib/`: model calls with retry and fallback, Supabase client, knowledge loader, policy tools
- `data/seed.json`: the fictional center's records
- `scripts/`: `seed.mjs`, `reset-demo.mjs` (restores the demo data), `eval.mjs` (the 21-question eval)

## Run it locally

```bash
npm install
npm run dev
```

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODEL=
```

Supabase needs three tables: `knowledge` (key, value jsonb), `question_log`, and `gaps`. Then run `node scripts/seed.mjs` and `node scripts/reset-demo.mjs`.

## Try the fail, fix, improve loop

1. In `/parent`, ask "Are you open on Veterans Day?" The assistant admits it does not know.
2. In `/admin`, the question is waiting in the gaps inbox.
3. Add an 11/11/2026 closure on that card. The original question re-runs and now resolves.

## Eval

`node scripts/eval.mjs` runs 21 questions I wrote (8 easy, 4 tricky, 5 sensitive, 4 unanswerable) with the date pinned to Oct 6, 2026. Each has an expected outcome, and many must also contain a specific fact. A system error counts as an error, never a pass. Final run: 21/21. These are my own questions on one model, not real parent traffic.

## Known limits

No login on `/admin`. Hand-offs are tickets in the control center, with no SMS or email alerts yet. Each question is answered on its own, with no conversation memory. Gaps are grouped by the classifier's topic label, not by meaning.
