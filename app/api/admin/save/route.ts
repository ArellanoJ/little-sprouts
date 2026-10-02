import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { key, value } = await req.json();
  if (!key || typeof key !== "string" || value === undefined) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { error } = await supabase
    .from("knowledge")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
