"use client";
import { useEffect, useMemo, useState } from "react";

type Log = { id: number; question: string; tier: string; answer: string | null; source: string | null; created_at: string };
type Gap = { id: number; question: string; theme: string | null; status: string; created_at: string };
type Fixed = { theme: string; question: string; answer: string; tier: string };

const BADGE: Record<string, string> = {
  answer: "bg-emerald-100 text-emerald-800",
  confirm: "bg-sky-100 text-sky-800",
  gap: "bg-amber-100 text-amber-800",
  handoff: "bg-rose-100 text-rose-800",
};
const HOLIDAY = /(veterans day|memorial day|labor day|juneteenth|presidents'? day|columbus day|indigenous peoples'? day)/i;
const JSON_HEADERS = { "content-type": "application/json" };

function Badge({ tier }: { tier: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[tier] ?? "bg-stone-100 text-stone-700"}`}>{tier}</span>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

function GapCard({ theme, items, onFixed }: { theme: string; items: Gap[]; onFixed: (f: Fixed) => void }) {
  const first = items[0].question;
  const holiday = first.match(HOLIDAY)?.[0];
  const [mode, setMode] = useState<"closure" | "answer">(holiday ? "closure" : "answer");
  const [date, setDate] = useState("");
  const [name, setName] = useState(holiday ? holiday.replace(/\b\w/g, (c) => c.toUpperCase()) : "");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ready = mode === "closure" ? !!date && !!name.trim() : !!answer.trim();

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ theme, mode, date, name, answer, question: first }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      // Re-run the original question to prove the fix worked.
      const a = await (await fetch("/api/ask", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ question: first }) })).json();
      onFixed({ theme, question: first, answer: a.answer, tier: a.tier });
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{theme}</div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
          {items.length} {items.length === 1 ? "parent" : "parents"} asked
        </span>
      </div>
      <ul className="mt-1 list-disc pl-5 text-sm text-stone-600">
        {items.slice(0, 3).map((g) => <li key={g.id}>{g.question}</li>)}
      </ul>

      <div className="mt-3 flex gap-2 text-xs">
        <button onClick={() => setMode("closure")} className={`rounded-full border px-3 py-1 ${mode === "closure" ? "bg-stone-900 text-white" : ""}`}>Add closure date</button>
        <button onClick={() => setMode("answer")} className={`rounded-full border px-3 py-1 ${mode === "answer" ? "bg-stone-900 text-white" : ""}`}>Write an answer</button>
      </div>

      {mode === "closure" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="flex-1 rounded border px-2 py-1 text-sm" />
        </div>
      ) : (
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Type the answer parents should get" className="mt-2 w-full rounded border px-2 py-1 text-sm" />
      )}

      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
      <button onClick={save} disabled={!ready || busy} className="mt-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {busy ? "Saving and re-running..." : "Save and re-run question"}
      </button>
    </div>
  );
}

function Editor({ kb, onSaved }: { kb: Record<string, any>; onSaved: () => void }) {
  const keys = Object.keys(kb).sort();
  const [key, setKey] = useState(keys[0] ?? "");
  const isHandbook = key.startsWith("handbook.");
  const initial = (k: string) => (k.startsWith("handbook.") ? kb[k]?.body ?? "" : JSON.stringify(kb[k], null, 2));
  const [text, setText] = useState(initial(key));
  const [msg, setMsg] = useState("");

  function pick(k: string) {
    setKey(k);
    setText(initial(k));
    setMsg("");
  }

  async function save() {
    let value: any;
    try {
      value = isHandbook
        ? { ...kb[key], body: text, updated: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }) }
        : JSON.parse(text);
    } catch {
      setMsg("That isn't valid JSON. Nothing was saved.");
      return;
    }
    const r = await fetch("/api/admin/save", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ key, value }) });
    setMsg(r.ok ? "Saved. The assistant uses this immediately." : "Save failed.");
    if (r.ok) onSaved();
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <select value={key} onChange={(e) => pick(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={isHandbook ? 6 : 12}
        className={`mt-2 w-full rounded border px-2 py-1 text-sm ${isHandbook ? "" : "font-mono text-xs"}`}
      />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white">Save</button>
        <span className="text-xs text-stone-500">{msg}</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState<{ log: Log[]; gaps: Gap[]; kb: Record<string, any> } | null>(null);
  const [fixed, setFixed] = useState<Fixed[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/admin/data", { cache: "no-store" });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setErr(e.message ?? "Could not load data");
    }
  }
  useEffect(() => { load(); }, []);

  const log = data?.log ?? [];
  const total = log.length;
  const ai = log.filter((l) => l.tier === "answer" || l.tier === "confirm").length;
  const pct = total ? Math.round((ai / total) * 100) : 0;
  const hours = ((ai * 3) / 60).toFixed(1);

  const groups = useMemo(() => {
    const m = new Map<string, Gap[]>();
    (data?.gaps ?? []).filter((g) => g.status === "open").forEach((g) => {
      const k = g.theme ?? "unknown";
      m.set(k, [...(m.get(k) ?? []), g]);
    });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  const tickets = (data?.gaps ?? []).filter((g) => g.status === "ticket");

  if (err) return <div className="p-6 text-rose-600">{err}</div>;
  if (!data) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-stone-50 p-4 text-stone-900">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Little Sprouts: control center</h1>
          <div className="text-xs text-stone-500">What parents asked, where the assistant struggled, and how to fix it</div>
        </div>
        <a href="/parent" className="text-sm text-emerald-700 underline">Parent view</a>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Questions" value={String(total)} />
        <Tile label="Answered by AI" value={`${pct}%`} sub="includes 'director can confirm'" />
        <Tile label="Open gaps" value={String(groups.length)} sub={`${tickets.length} sensitive tickets`} />
        <Tile label="Est. staff time saved" value={`${hours} hrs`} sub="assumes 3 min per AI answer" />
      </section>

      {fixed.length > 0 && (
        <section className="space-y-2">
          {fixed.map((f, i) => (
            <div key={i} className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
              <div className="font-medium text-emerald-800">Fixed: "{f.question}" now resolves</div>
              <div className="mt-1">{f.answer}</div>
              <div className="mt-1"><Badge tier={f.tier} /></div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Gaps inbox</h2>
        <div className="space-y-3">
          {groups.length === 0 && <div className="text-sm text-stone-500">No open gaps.</div>}
          {groups.map(([theme, items]) => (
            <GapCard
              key={theme}
              theme={theme}
              items={items}
              onFixed={(f) => { setFixed((x) => [f, ...x]); load(); }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Sensitive tickets (handed to a person)</h2>
        <div className="space-y-1">
          {tickets.length === 0 && <div className="text-sm text-stone-500">None.</div>}
          {tickets.map((t) => (
            <div key={t.id} className="rounded border bg-white px-3 py-2 text-sm">
              <div>{t.question}</div>
              <div className="text-xs text-stone-500">{t.theme}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Knowledge editor</h2>
        <Editor key={Object.keys(data.kb).join(",")} kb={data.kb} onSaved={load} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Question log</h2>
        <div className="max-h-96 divide-y overflow-y-auto rounded-lg border bg-white">
          {log.slice(0, 50).map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <div>{l.question}</div>
                <div className="text-xs text-stone-400">
                  {new Date(l.created_at).toLocaleString()}{l.source ? ` · ${l.source}` : ""}
                </div>
              </div>
              <Badge tier={l.tier} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
