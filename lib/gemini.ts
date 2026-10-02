import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TOTAL_BUDGET_MS = 20000; // give up after 20s so the route can still send its safe message
const PER_CALL_MS = 8000;      // a single hung call can't eat the whole budget
const RETRY_HINT = /retry in ([\d.]+)s/i;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout: UNAVAILABLE")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function askGemini(prompt: string, json = false): Promise<string> {
  const models = [...new Set([process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean))] as string[];
  const started = Date.now();
  let lastErr: any;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() - started > TOTAL_BUDGET_MS) throw lastErr ?? new Error("budget exceeded");
      try {
        const res = await withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: json
              ? { responseMimeType: "application/json", temperature: 0 }
              : { temperature: 0.2 },
          }),
          PER_CALL_MS
        );
        return res.text ?? "";
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message);
        console.warn(`GEMINI FAIL model=${model} attempt=${attempt + 1}: ${msg.slice(0, 160)}`);
        if (/PerDay/.test(msg)) break; // daily quota gone: go straight to the fallback model
        const retryable = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/.test(msg);
        if (!retryable) break; // bad key or bad model name: retrying won't help
        const hint = msg.match(RETRY_HINT);
        const wait = hint ? Math.ceil(parseFloat(hint[1])) * 1000 + 500 : 800 * (attempt + 1);
        if (Date.now() - started + wait > TOTAL_BUDGET_MS) break; // not enough time left: try the next model
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}
