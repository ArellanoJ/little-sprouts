import { supabase } from "./supabase";

export async function loadKnowledge(): Promise<Record<string, any>> {
  const { data, error } = await supabase.from("knowledge").select("key,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}
