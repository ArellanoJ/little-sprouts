import { supabase } from "@/lib/supabase";
import { loadKnowledge } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [log, gaps, kb] = await Promise.all([
      supabase.from("question_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("gaps").select("*").order("created_at", { ascending: false }).limit(200),
      loadKnowledge(),
    ]);
    return Response.json({ log: log.data ?? [], gaps: gaps.data ?? [], kb });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "load failed" }, { status: 500 });
  }
}
