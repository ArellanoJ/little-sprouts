"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Log = { id: number; question: string; tier: string; answer: string | null; source: string | null; created_at: string };
type Gap = { id: number; question: string; theme: string | null; status: string; created_at: string };
type Fixed = { theme: string; question: string; answer: string; tier: string };

const TIERS: Record<string, { label: string; badge: string; bar: string }> = {
  answer: { label: "Answered", badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  confirm: { label: "Director confirms", badge: "bg-sky-100 text-sky-800", bar: "bg-sky-500" },
  gap: { label: "Gap", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  handoff: { label: "Handed off", badge: "bg-rose-100 text-rose-800", bar: "bg-rose-500" },
};
const HOLIDAY = /(veterans day|memorial day|labor day|juneteenth|presidents'? day|columbus day|indigenous peoples'? day)/i;
const JSON_HEADERS = { "content-type": "application/json" };
const INPUT = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const PRIMARY = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50";

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function kbLabel(k: string, v: any) {
  if (k.startsWith("handbook.")) return `Handbook · ${v?.title ?? k.slice(9)}`;
  if (k.startsWith("faq.")) return `Director answer · ${String(v?.question ?? k.slice(4)).slice(0, 40)}`;
  const t = k.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Badge({ tier }: { tier: string }) {
  const t = TIERS[tier];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${t?.badge ?? "bg-stone-100 text-stone-700"}`}>
      {t?.label ?? tier}
    </span>
  );
}

function Tile({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
        <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm ${tone}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

function OutcomeBar({ log }: { log: Log[] }) {
  const total = log.length || 1;
  const counts = Object.keys(TIERS).map((t) => ({ t, n: log.filter((l) => l.tier === t).length }));
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs font-medium text-stone-500">How questions were handled</div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
        {counts.map(({ t, n }) =>
          n ? <div key={t} className={TIERS[t].bar} style={{ width: `${(n / total) * 100}%` }} /> : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {counts.map(({ t, n }) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TIERS[t].bar}`} />
            {TIERS[t].label} <b className="font-semibold text-stone-800">{n}</b>
          </span>
        ))}
      </div>
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
    <div className="rounded-2xl border border-l-4 border-stone-200 border-l-amber-400 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-stone-900">{theme}</div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          {items.length} {items.length === 1 ? "parent" : "parents"} asked
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-stone-600">
        {items.slice(0, 3).map((g) => (
          <li key={g.id} className="flex gap-2"><span className="text-stone-300">“</span>{g.question}</li>
        ))}
        {items.length > 3 && <li className="text-xs text-stone-400">+ {items.length - 3} more</li>}
      </ul>

      <div className="mt-3 inline-flex rounded-full bg-stone-100 p-1 text-xs font-medium">
        {(["closure", "answer"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1.5 transition ${mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
          >
            {m === "closure" ? "Add closure date" : "Write an answer"}
          </button>
        ))}
      </div>

      {mode === "closure" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className={`${INPUT} min-w-0 flex-1`} />
        </div>
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          placeholder="Type the answer parents should get"
          className={`${INPUT} mt-3 w-full`}
        />
      )}

      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
      <button onClick={save} disabled={!ready || busy} className={`${PRIMARY} mt-3`}>
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
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-stone-500">
        The assistant answers only from this. Facts like hours and tuition are structured data; policies are plain text.
      </p>
      <select value={key} onChange={(e) => pick(e.target.value)} className={`${INPUT} w-full`}>
        {keys.map((k) => (
          <option key={k} value={k}>{kbLabel(k, kb[k])}</option>
        ))}
      </select>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={isHandbook ? 6 : 12}
        className={`${INPUT} mt-3 w-full ${isHandbook ? "" : "font-mono text-xs"}`}
      />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} className={PRIMARY}>Save</button>
        <span className="text-xs text-stone-500">{msg}</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState<{ log: Log[]; gaps: Gap[]; kb: Record<string, any> } | null>(null);
  const [fixed, setFixed] = useState<Fixed[]>([]);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"gaps" | "log" | "kb">("gaps");
  const [filter, setFilter] = useState("all");

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
  useEffect(() => {
    document.title = "Little Sprouts · Control center";
    load();
  }, []);

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
  const shownLog = log.filter((l) => filter === "all" || l.tier === filter).slice(0, 100);

  if (err) {
    return (
      <div className="mx-auto max-w-md p-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Couldn&apos;t load data: {err}
          <button onClick={() => { setErr(""); load(); }} className="ml-2 underline">Retry</button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-stone-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    );
  }

  const TABS = [
    { id: "gaps" as const, label: "Gaps inbox", badge: groups.length },
    { id: "log" as const, label: "Question log", badge: 0 },
    { id: "kb" as const, label: "Knowledge", badge: 0 },
  ];

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-xl">🌱</div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Little Sprouts: control center</h1>
              <div className="text-xs text-stone-500">What parents asked, where the assistant struggled, and how to fix it</div>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <button onClick={load} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:bg-stone-100">Refresh</button>
            <Link href="/parent" target="_blank" className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-emerald-700 hover:bg-stone-100">
              Parent view ↗
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon="💬" label="Questions" value={String(total)} tone="bg-stone-100" />
          <Tile icon="✅" label="Answered by AI" value={`${pct}%`} sub="includes 'director can confirm'" tone="bg-emerald-100" />
          <Tile icon="📥" label="Open gaps" value={String(groups.length)} sub={`${tickets.length} sensitive tickets`} tone="bg-amber-100" />
          <Tile icon="⏱️" label="Est. staff time saved" value={`${hours} hrs`} sub="assumes 3 min per AI answer" tone="bg-sky-100" />
        </section>

        <OutcomeBar log={log} />

        {fixed.length > 0 && (
          <section className="space-y-2">
            {fixed.map((f, i) => (
              <div key={i} className="msg-in rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-emerald-800">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
                  Fixed: &quot;{f.question}&quot; now resolves
                </div>
                <div className="mt-2 text-stone-800">{f.answer}</div>
                <div className="mt-2"><Badge tier={f.tier} /></div>
              </div>
            ))}
          </section>
        )}

        <nav className="flex gap-1 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {tab === "gaps" && (
          <div className="space-y-6">
            <section className="space-y-3">
              {groups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
                  🎉 No open gaps. Everything parents asked has an answer.
                </div>
              )}
              {groups.map(([theme, items]) => (
                <GapCard
                  key={theme}
                  theme={theme}
                  items={items}
                  onFixed={(f) => { setFixed((x) => [f, ...x]); load(); }}
                />
              ))}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-stone-700">Sensitive tickets (handed to a person)</h2>
              <div className="space-y-2">
                {tickets.length === 0 && <div className="text-sm text-stone-500">None.</div>}
                {tickets.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-l-4 border-stone-200 border-l-rose-400 bg-white px-4 py-2.5 text-sm shadow-sm">
                    <div>
                      <div>{t.question}</div>
                      <div className="text-xs text-stone-500">{t.theme}</div>
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">{ago(t.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "log" && (
          <section>
            <div className="mb-3 flex flex-wrap gap-2">
              {["all", ...Object.keys(TIERS)].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filter === f ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {f === "all" ? "All" : TIERS[f].label}
                </button>
              ))}
            </div>
            <div className="max-h-[32rem] divide-y divide-stone-100 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
              {shownLog.length === 0 && <div className="p-6 text-center text-sm text-stone-500">Nothing here yet.</div>}
              {shownLog.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-stone-800">{l.question}</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      {ago(l.created_at)}{l.source ? ` · ${l.source}` : ""}
                    </div>
                  </div>
                  <Badge tier={l.tier} />
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "kb" && (
          <section>
            <Editor key={Object.keys(data.kb).join(",")} kb={data.kb} onSaved={load} />
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-stone-400">
          Prototype with fictional data. No login on this page.
        </footer>
      </div>
    </div>
  );
}
