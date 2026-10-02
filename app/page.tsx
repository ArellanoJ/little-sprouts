import Link from "next/link";

export const metadata = {
  title: "Little Sprouts · AI Front Desk",
  description: "Prototype AI front desk for a fictional daycare: parent chat and operator control center.",
};

export default function Home() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-50 to-stone-50 px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-2xl">🌱</div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Little Sprouts AI Front Desk</h1>
            <p className="text-sm text-stone-500">A prototype for a fictional daycare. All data is invented.</p>
          </div>
        </div>

        <p className="mt-6 max-w-xl text-stone-600">
          Code decides every fact (dates, the fever rule, the lunch cutoff). The AI only reads the question and words the reply.
          Sensitive topics skip the AI and go to a person.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/parent" className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
            <div className="text-2xl">💬</div>
            <div className="mt-3 text-lg font-semibold text-stone-900">Parent view</div>
            <p className="mt-1 text-sm text-stone-500">Ask the front desk a question, the way a parent would on their phone.</p>
            <div className="mt-4 text-sm font-medium text-emerald-700 group-hover:underline">Open chat →</div>
          </Link>
          <Link href="/admin" className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
            <div className="text-2xl">🗂️</div>
            <div className="mt-3 text-lg font-semibold text-stone-900">Operator view</div>
            <p className="mt-1 text-sm text-stone-500">See what parents asked, where the assistant struggled, and fix gaps in one step.</p>
            <div className="mt-4 text-sm font-medium text-emerald-700 group-hover:underline">Open control center →</div>
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-stone-900">Try the fail, fix, improve loop</div>
          <ol className="mt-3 space-y-2 text-sm text-stone-600">
            <li><b className="text-stone-800">1.</b> In the parent view, ask <i>&quot;Are you open on Veterans Day?&quot;</i>. The assistant admits it doesn&apos;t know.</li>
            <li><b className="text-stone-800">2.</b> In the control center, the question is waiting in the gaps inbox.</li>
            <li><b className="text-stone-800">3.</b> Add a closure for 11/11/2026 and click <i>Save and re-run question</i>. The same question now resolves.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
