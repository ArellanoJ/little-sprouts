const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Closure = { date: string; name: string };

// "2026-11-11" -> weekday name. Uses UTC so the server's timezone can't shift the day.
export function dayName(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Today in Seattle time, or a pinned date for testing and evals.
export function todayISO(pinned?: string) {
  if (pinned) return pinned;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

// Is the center open on this date? Returns "unknown" when a named holiday isn't on file.
export function checkClosure(
  iso: string,
  hours: { days: string[] },
  closures: Closure[],
  holidayName?: string
) {
  const byDate = closures.find((c) => c.date === iso);
  const byName = holidayName
    ? closures.find((c) => c.name.toLowerCase().includes(holidayName.toLowerCase()))
    : undefined;
  const hit = byDate ?? byName;

  if (hit) return { status: "closed" as const, reason: hit.name, date: hit.date, weekday: dayName(hit.date), reopens: nextOpenDay(hit.date, hours, closures) };
  if (holidayName) return { status: "unknown" as const };            // holiday named, nothing on file -> gap
  if (!hours.days.includes(dayName(iso))) return { status: "closed" as const, reason: "weekend", date: iso, weekday: dayName(iso), reopens: nextOpenDay(iso, hours, closures) };
  return { status: "open" as const, date: iso, weekday: dayName(iso) };
}

export function nextOpenDay(iso: string, hours: { days: string[] }, closures: Closure[]) {
  let d = addDays(iso, 1);
  for (let i = 0; i < 14; i++) {
    if (hours.days.includes(dayName(d)) && !closures.some((c) => c.date === d)) return { date: d, weekday: dayName(d) };
    d = addDays(d, 1);
  }
  return null;
}

export function getMenu(iso: string, menu: Record<string, any>) {
  const day = dayName(iso);
  return menu[day] ? { weekday: day, ...menu[day], allergen_note: menu.allergen_note } : null;
}

// Arithmetic belongs in code, not in the LLM.
export function checkFever(tempF: number, rule: { fever_threshold_f: number; fever_free_hours_required: number }) {
  return tempF >= rule.fever_threshold_f
    ? { stayHome: true, threshold: rule.fever_threshold_f, hoursRequired: rule.fever_free_hours_required }
    : { stayHome: false, threshold: rule.fever_threshold_f };
}

// "HH:MM" strings compare correctly as text.
export function lunchCutoff(nowHHMM: string, policy: { request_cutoff: string; backup_lunch_price: number }) {
  return { beforeCutoff: nowHHMM <= policy.request_cutoff, cutoff: policy.request_cutoff, price: policy.backup_lunch_price };
}
