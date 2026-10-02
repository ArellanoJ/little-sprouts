import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import ws from "ws";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

const seed = JSON.parse(readFileSync("data/seed.json", "utf8"));

const rows = Object.entries(seed).map(([key, value]) => ({
  key,
  value,
  updated_at: new Date().toISOString(),
}));

const { error } = await supabase
  .from("knowledge")
  .upsert(rows, { onConflict: "key" });

console.log(error ? `FAILED: ${error.message}` : `Seeded ${rows.length} rows.`);
