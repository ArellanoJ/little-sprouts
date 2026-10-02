import { supabase } from "@/lib/supabase";
import { loadKnowledge } from "@/lib/knowledge";

export async function POST(req: Request) {
  const { theme, mode, date, name, answer, question } = await req.json();
  const stamp = new Date().toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "America/Los_Angeles" });
  const bad = (m: string) => Response.json({ error: m }, { status: 400 });

  if (mode === "closure") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !String(name ?? "").trim()) return bad("Need a date and a name");
    const kb = await loadKnowledge();
    const closures = [...(kb.closures ?? []).filter((c: any) => c.date !== date), { date, name: String(name).trim() }]
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    const { error } = await supabase
      .from("knowledge")
      .upsert({ key: "closures", value: closures, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else if (mode === "answer") {
    if (!String(answer ?? "").trim() || !question) return bad("Need an answer");
    const slug = String(theme ?? question).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "faq";
    const { error } = await supabase
      .from("knowledge")
      .upsert(
        { key: `faq.${slug}`, value: { question, answer: String(answer).trim(), updated: stamp }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    return bad("Unknown mode");
  }

  // Mark every open gap in this theme as resolved.
  let upd = supabase.from("gaps").update({ status: "resolved" }).eq("status", "open");
  upd = theme ? upd.eq("theme", theme) : upd.is("theme", null);
  const { error: gapErr } = await upd;
  if (gapErr) return Response.json({ error: gapErr.message }, { status: 500 });

  // Closure fix: also close open gaps that mention the holiday by name, even under a different theme label.
  if (mode === "closure") {
    const needle = String(name).trim().replace(/[%_,()]/g, "");
    if (needle) {
      const { error: nameErr } = await supabase
        .from("gaps")
        .update({ status: "resolved" })
        .eq("status", "open")
        .ilike("question", `%${needle}%`);
      if (nameErr) return Response.json({ error: nameErr.message }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
