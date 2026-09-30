// Parsing/formatting for our own date (dd/mm/åååå) and time (tt:mm) fields.
// Values in the app stay "YYYY-MM-DD" and "HH:MM"; only what the user sees changes.

const pad = (n: number) => String(n).padStart(2, "0");

/** While typing: digits only, colon after the hours. "1530" → "15:30". */
export function maskTime(raw: string): string {
  // "9:30" / "9.30": a single-digit hour followed by a separator gets its leading zero first.
  const d = raw.replace(/^(\d)[:.]/, "0$1:").replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/** Text → "HH:MM", or null if not a valid time. Accepts "9", "930", "0930", "9:30", "9.30", "15:5" is invalid. */
export function parseTime(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  let h: number;
  let m: number;
  const sep = t.match(/^(\d{1,2})[:.](\d{2})$/);
  if (sep) {
    h = +sep[1];
    m = +sep[2];
  } else if (/^\d{1,4}$/.test(t)) {
    // 1–2 digits = whole hours; 3–4 digits = hours + minutes.
    h = t.length <= 2 ? +t : +t.slice(0, t.length - 2);
    m = t.length <= 2 ? 0 : +t.slice(-2);
  } else {
    return null;
  }
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null;
}

/** While typing: digits only, slashes after day and month. "10102026" → "10/10/2026". */
export function maskDate(raw: string): string {
  // "1/2/2026": single-digit day/month followed by a separator gets its leading zero first.
  const d = raw
    .replace(/(^|[/.-])(\d)(?=[/.-])/g, "$10$2")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** "dd/mm/åååå" (also with . or -) → "YYYY-MM-DD", or null if not a real date. */
export function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) ?? text.trim().match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [+m[1], +m[2], +m[3]];
  const d = new Date(Date.UTC(year, month - 1, day));
  const real = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  return real && year >= 2000 && year <= 2100 ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/** "YYYY-MM-DD" → "dd/mm/åååå" (empty stays empty). */
export function isoToDisplayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
