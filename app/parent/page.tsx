"use client";
import { useState, useRef, useEffect } from "react";

type Msg = {
  role: "user" | "bot";
  text: string;
  tier?: string;
  source?: string | null;
  why?: any;
};

const SUGGESTED = [
  "Are you open on Veterans Day?",
  "What's for lunch today?",
  "My daughter has a temp of 99.8, can she come in?",
  "How much is infant tuition?",
];

const TIER_LABEL: Record<string, string> = {
  confirm: "Director can confirm for your situation",
  gap: "Sent to the director",
  handoff: "Handed to a person",
};

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

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
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
      setMsgs((m) => [
        ...m,
        { role: "bot", text: d.answer, tier: d.tier, source: d.source, why: d.why },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "bot", text: "I'm having trouble right now. Please call the front desk.", tier: "gap" },
      ]);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-stone-50 text-stone-900">
      <header className="border-b bg-white px-4 py-3">
        <div className="font-semibold">Little Sprouts Early Learning</div>
        <div className="text-xs text-stone-500">Front desk assistant · Mon–Fri, 7am–6pm</div>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[85%]">
              <div
                className={
                  m.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white"
                    : m.tier === "handoff"
                    ? "rounded-2xl rounded-bl-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                    : "rounded-2xl rounded-bl-sm border bg-white px-3 py-2 text-sm"
                }
              >
                {m.text}
              </div>

              {m.role === "bot" && m.tier && TIER_LABEL[m.tier] && (
                <div className="mt-1 text-xs text-amber-700">{TIER_LABEL[m.tier]}</div>
              )}

              {m.role === "bot" && m.source && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    From: {m.source}
                  </span>
                  <button
                    className="text-xs text-stone-500 underline"
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    why this answer
                  </button>
                </div>
              )}

              {open === i && m.why && (
                <pre className="mt-1 whitespace-pre-wrap rounded bg-stone-100 p-2 text-xs text-stone-600">
                  {JSON.stringify(m.why, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-stone-400">Checking...</div>}
        <div ref={bottom} />
      </main>

      <div className="flex gap-2 overflow-x-auto border-t bg-white px-4 pt-3">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={busy}
            className="shrink-0 rounded-full border px-3 py-1 text-xs text-stone-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 bg-white px-4 pb-4 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Ask a question..."
          className="flex-1 rounded-full border px-4 py-2 text-base outline-none"
        />
        <button
          onClick={() => ask(input)}
          disabled={busy || !input.trim()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
