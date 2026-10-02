"use client";
import { useEffect, useRef, useState } from "react";

type Why = { intent?: string; tool?: string; rule?: string; overrides?: string[] };
type Msg = {
  role: "user" | "bot";
  text: string;
  tier?: string;
  source?: string | null;
  why?: Why | null;
};

const SUGGESTED = [
  { icon: "📅", text: "Are you open on Veterans Day?" },
  { icon: "🍎", text: "What's for lunch today?" },
  { icon: "🌡️", text: "My daughter has a temp of 99.8, can she come in?" },
  { icon: "💵", text: "How much is infant tuition?" },
  { icon: "🏫", text: "How can I schedule a tour?" },
  { icon: "⏰", text: "What's the late pickup fee?" },
];

const TOPIC: Record<string, string> = {
  hours_closures: "Hours & closures",
  tuition: "Tuition",
  illness: "Illness policy",
  lunch: "Meals",
  late_pickup: "Late pickup",
  tour: "Tours",
  contact: "Contact",
  other: "Not in the handbook",
};

const TOOL: Record<string, string> = {
  checkClosure: "Closure calendar lookup (code)",
  checkFever: "Fever rule check (code)",
  "getMenu + lunchCutoff": "Menu and lunch cutoff (code)",
  "director-written answer": "Answer written by the director",
  "hours lookup": "Hours lookup",
  "tuition lookup": "Tuition lookup",
  "illness policy": "Illness policy",
  "late pickup lookup": "Late pickup policy",
  "tour lookup": "Tour schedule",
  "contact lookup": "Contact details",
};

const RULE: Record<string, string> = {
  "sensitive topic, no AI answer": "Sensitive topic, so a person handles it and the AI stays out",
  "no supporting source found": "No supporting source, so I didn't guess",
  "system error": "Technical problem, so I sent it to the director",
};

const STATUS: Record<string, { icon: string; text: string; cls: string }> = {
  confirm: { icon: "👩‍🏫", text: "Director can confirm for your situation", cls: "bg-sky-100 text-sky-800" },
  gap: { icon: "📨", text: "Sent to the director", cls: "bg-amber-100 text-amber-800" },
  handoff: { icon: "🤝", text: "Handed to a person", cls: "bg-rose-100 text-rose-800" },
};

const PHONE = /\(\d{3}\)\s?\d{3}-\d{4}/;

function phoneOf(text: string) {
  const m = text.match(PHONE);
  return m ? { label: m[0], href: `tel:${m[0].replace(/\D/g, "")}` } : null;
}

function bubble(m: Msg) {
  const base = "rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-snug shadow-sm";
  if (m.tier === "handoff") {
    return `${base} ${/911/.test(m.text) ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`;
  }
  if (m.tier === "gap") return `${base} border-stone-200 bg-stone-50 text-stone-800`;
  return `${base} border-stone-200 bg-white text-stone-800`;
}

function Avatar() {
  return <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-base">🌱</div>;
}

export default function Parent() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hi! I'm the front desk assistant for Little Sprouts Early Learning. Ask me about hours, tuition, lunch, illness, or tours.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const started = msgs.length > 1;

  useEffect(() => {
    document.title = "Little Sprouts · Front desk";
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d = await res.json();
      setMsgs((m) => [...m, { role: "bot", text: d.answer, tier: d.tier, source: d.source, why: d.why }]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "bot", text: "I'm having trouble right now. Please call the front desk at (206) 555-0142.", tier: "gap" },
      ]);
    }
    setBusy(false);
  }

  return (
    <div className="min-h-dvh bg-stone-200/60 sm:py-6">
      <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-gradient-to-b from-emerald-50/70 to-stone-50 text-stone-900 sm:h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-stone-300 sm:shadow-xl">
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-200 to-emerald-100 text-xl">🌱</div>
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">Little Sprouts Early Learning</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Front desk assistant · Mon–Fri, 7am–6pm
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="msg-in flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-600 px-3.5 py-2 text-[15px] leading-snug text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              );
            }
            const status = m.tier ? STATUS[m.tier] : undefined;
            const phone = m.tier === "gap" || m.tier === "handoff" ? phoneOf(m.text) : null;
            return (
              <div key={i} className="msg-in flex items-end gap-2">
                <Avatar />
                <div className="min-w-0 max-w-[82%]">
                  <div className={bubble(m)}>{m.text}</div>

                  {(status || phone) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {status && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                          {status.icon} {status.text}
                        </span>
                      )}
                      {phone && (
                        <a href={phone.href} className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-700">
                          📞 Call {phone.label}
                        </a>
                      )}
                    </div>
                  )}

                  {(m.source || m.why) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {m.source && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          📄 From: {m.source}
                        </span>
                      )}
                      {m.why && (
                        <button className="text-xs text-stone-500 underline" onClick={() => setOpen(open === i ? null : i)}>
                          {open === i ? "hide details" : "why this answer"}
                        </button>
                      )}
                    </div>
                  )}

                  {open === i && m.why && (
                    <div className="mt-2 rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-600 shadow-sm">
                      <div className="mb-1.5 font-semibold text-stone-800">How I got this</div>
                      <ul className="space-y-1">
                        {m.why.intent && (
                          <li><span className="text-stone-400">Topic: </span>{TOPIC[m.why.intent] ?? m.why.intent}</li>
                        )}
                        {m.why.tool && (
                          <li><span className="text-stone-400">Method: </span>{TOOL[m.why.tool] ?? m.why.tool}</li>
                        )}
                        {m.why.rule && (
                          <li><span className="text-stone-400">Rule: </span>{RULE[m.why.rule] ?? m.why.rule}</li>
                        )}
                        {m.why.overrides && m.why.overrides.length > 0 && (
                          <li><span className="text-stone-400">Safety rule applied: </span>{m.why.overrides.join(", ")}</li>
                        )}
                      </ul>
                      <p className="mt-2 text-stone-400">{"Facts come from the center's own records. The AI only words the reply."}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!started && (
            <div className="msg-in space-y-2 pl-10">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Try asking</p>
              {SUGGESTED.map((s) => (
                <button
                  key={s.text}
                  onClick={() => ask(s.text)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
                >
                  <span>{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          )}

          {busy && (
            <div className="msg-in flex items-end gap-2">
              <Avatar />
              <div className="flex gap-1 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 shadow-sm">
                {[0, 1, 2].map((n) => (
                  <span
                    key={n}
                    className="h-2 w-2 animate-bounce rounded-full bg-stone-400"
                    style={{ animationDelay: `${n * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </main>

        <div className="border-t border-stone-200 bg-white/90 backdrop-blur">
          {started && (
            <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTED.map((s) => (
                <button
                  key={s.text}
                  onClick={() => ask(s.text)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-700 disabled:opacity-50"
                >
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-4 pb-1 pt-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder="Ask a question..."
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={() => ask(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-[11px] text-stone-400">
            AI assistant. In an emergency, call 911.
          </p>
        </div>
      </div>
    </div>
  );
}
