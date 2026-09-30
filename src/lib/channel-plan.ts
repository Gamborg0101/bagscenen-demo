// Channel plans (input lists): mixers, inputs, validation, templates, summary and paste.
// Pure module — used by the editor, the views and tests.
import { z } from "zod";
import type { DiType, InputSource, Mixer } from "@prisma/client";

export const MIXERS: Record<Mixer, { label: string; channels: number; mixerInputs: number; stagebox: boolean }> = {
  SQ7: { label: "Allen & Heath SQ7", channels: 48, mixerInputs: 32, stagebox: true },
  SQ5: { label: "Allen & Heath SQ5", channels: 48, mixerInputs: 16, stagebox: true },
  MACKIE: { label: "Mackie (8 kanaler)", channels: 8, mixerInputs: 8, stagebox: false },
};

/** The stagebox (AR2412 1–24 + chained AB168 25–40) or the mixer's own inputs. */
export const INPUT_LABEL: Record<InputSource, string> = { STAGEBOX: "Stagebox", MIXER: "Mixer" };
export const STAGEBOX_INPUTS = 40;

export function inputLimit(source: InputSource, mixer: Mixer): number {
  if (source === "STAGEBOX") return MIXERS[mixer].stagebox ? STAGEBOX_INPUTS : 0;
  return MIXERS[mixer].mixerInputs;
}

/** Input types a mixer has (Mackie: mixer only). */
export const inputSources = (mixer: Mixer): InputSource[] => (MIXERS[mixer].stagebox ? ["STAGEBOX", "MIXER"] : ["MIXER"]);

export function inputLabel(source: InputSource | "" | null | undefined, n: number | null | undefined): string {
  return source && n ? `${INPUT_LABEL[source]} ${n}` : "";
}

export const DI_LABEL: Record<DiType, string> = { NONE: "– DI", MONO: "Mono DI", STEREO: "Stereo DI" };

// ---------- Editor rows and validation ----------

export type ChannelRow = {
  number: number;
  source: string;
  gear: string;
  di: DiType;
  phantom: boolean;
  inputSource: InputSource | "";
  inputNumber: number | null;
  note: string;
};

export const emptyRow = (number: number): ChannelRow => ({
  number,
  source: "",
  gear: "",
  di: "NONE",
  phantom: false,
  inputSource: "",
  inputNumber: null,
  note: "",
});
export const isEmptyRow = (r: ChannelRow) =>
  !r.source.trim() && !r.gear.trim() && r.di === "NONE" && !r.phantom && !r.inputSource && r.inputNumber == null && !r.note.trim();

/** A problem with a row's input, in Danish, or null. */
export function inputProblem(r: Pick<ChannelRow, "number" | "inputSource" | "inputNumber">, mixer: Mixer): string | null {
  if (!r.inputSource && r.inputNumber == null) return null;
  if (!r.inputSource) return `Kanal ${r.number}: vælg Stagebox eller Mixer`;
  if (r.inputNumber == null) return `Kanal ${r.number}: skriv inputnummer`;
  const max = inputLimit(r.inputSource, mixer);
  if (max === 0) return `Kanal ${r.number}: ${MIXERS[mixer].label} har ingen stagebox`;
  if (r.inputNumber < 1 || r.inputNumber > max) return `Kanal ${r.number}: ${INPUT_LABEL[r.inputSource]} har input 1–${max}`;
  return null;
}

const rowSchema = z.object({
  number: z.number().int().min(1).max(48),
  source: z.string().trim().max(80),
  gear: z.string().trim().max(80),
  di: z.enum(["NONE", "MONO", "STEREO"]),
  phantom: z.boolean(),
  inputSource: z.enum(["STAGEBOX", "MIXER", ""]),
  inputNumber: z.number().int().min(1).max(99).nullable(),
  note: z.string().trim().max(200),
});

export const planSaveSchema = z
  .object({
    name: z.string().trim().min(1, "Giv planen et navn").max(120),
    mixer: z.enum(["SQ7", "SQ5", "MACKIE"]),
    channels: z.array(rowSchema).max(48),
    version: z.string().max(40), // updatedAt when the editor loaded — guards against overwriting others
  })
  .superRefine((p, ctx) => {
    const numbers = new Set<number>();
    for (const [i, r] of p.channels.entries()) {
      if (numbers.has(r.number)) ctx.addIssue({ code: "custom", path: ["channels", i, "number"], message: `Kanal ${r.number} findes to gange` });
      numbers.add(r.number);
      if (r.number > MIXERS[p.mixer].channels && !isEmptyRow(r)) {
        ctx.addIssue({ code: "custom", path: ["channels", i, "number"], message: `${MIXERS[p.mixer].label} har kun ${MIXERS[p.mixer].channels} kanaler` });
      }
      const problem = inputProblem(r, p.mixer);
      if (problem) ctx.addIssue({ code: "custom", path: ["channels", i, "inputNumber"], message: problem });
    }
  });

/** Rows worth saving: filled ones only. */
export function rowsToDb(rows: ChannelRow[]) {
  return rows
    .filter((r) => !isEmptyRow(r))
    .map((r) => ({
      number: r.number,
      source: r.source.trim(),
      gear: r.gear.trim() || null,
      di: r.di,
      phantom: r.phantom,
      inputSource: r.inputSource || null,
      inputNumber: r.inputSource ? r.inputNumber : null,
      note: r.note.trim() || null,
    }));
}

// ---------- Summary ----------

export type PlanSummary = {
  channels: number;
  monoDi: number;
  stereoDi: number; // boxes: each stereo DI covers two channels (L + R)
  phantom: number;
  duplicateInputs: string[]; // e.g. ["Stagebox 3 (kanal 2 og 5)"]
};

export function summarize(rows: ChannelRow[]): PlanSummary {
  const used = rows.filter((r) => !isEmptyRow(r));
  const byInput = new Map<string, number[]>();
  for (const r of used) {
    if (!r.inputSource || r.inputNumber == null) continue;
    const key = inputLabel(r.inputSource, r.inputNumber);
    byInput.set(key, [...(byInput.get(key) ?? []), r.number]);
  }
  return {
    channels: used.length,
    monoDi: used.filter((r) => r.di === "MONO").length,
    stereoDi: Math.ceil(used.filter((r) => r.di === "STEREO").length / 2),
    phantom: used.filter((r) => r.phantom).length,
    duplicateInputs: [...byInput].filter(([, chs]) => chs.length > 1).map(([label, chs]) => `${label} (kanal ${chs.join(" og ")})`),
  };
}

// ---------- Templates ----------

type TemplateRow = Partial<Omit<ChannelRow, "number">> & { source: string };
export const TEMPLATES: { key: string; label: string; rows: TemplateRow[] }[] = [
  {
    key: "drums",
    label: "Trommesæt",
    rows: [
      { source: "Kick in" },
      { source: "Kick out" },
      { source: "Snare top" },
      { source: "Snare bottom" },
      { source: "Hi-hat" },
      { source: "Tom 1" },
      { source: "Tom 2" },
      { source: "Floor tom" },
      { source: "OH L", phantom: true },
      { source: "OH R", phantom: true },
    ],
  },
  { key: "bass", label: "Bas (DI)", rows: [{ source: "Bas", di: "MONO" }] },
  { key: "guitars", label: "Guitarer", rows: [{ source: "Guitar 1" }, { source: "Guitar 2" }] },
  { key: "vocals", label: "Vokal", rows: [{ source: "Lead vokal" }, { source: "Kor 1" }, { source: "Kor 2" }] },
  { key: "keys-mono", label: "Keys (mono)", rows: [{ source: "Keys", di: "MONO" }] },
  { key: "keys-stereo", label: "Keys (stereo)", rows: [{ source: "Keys L", di: "STEREO" }, { source: "Keys R", di: "STEREO" }] },
];

/** Puts template rows into the first empty channels, adding channels up to the mixer's limit. */
export function applyTemplate(rows: ChannelRow[], template: TemplateRow[], maxChannels: number): ChannelRow[] {
  const out = rows.map((r) => ({ ...r }));
  let i = 0;
  for (const t of template) {
    while (i < out.length && !isEmptyRow(out[i])) i++;
    if (i >= out.length) {
      if (out.length >= maxChannels) break;
      out.push(emptyRow(out.length + 1));
    }
    out[i] = { ...out[i], ...t };
    i++;
  }
  return out;
}

// ---------- Paste from Excel / Google Sheets ----------

export const EDIT_COLUMNS = ["source", "gear", "di", "phantom", "input", "note"] as const;
export type EditColumn = (typeof EDIT_COLUMNS)[number];

const truthy = (v: string) => /^(x|ja|yes|y|1|✓|✔|true|48v|\+48v?|p48)$/i.test(v.trim());

export function parseDi(v: string): DiType {
  const t = v.trim().toLowerCase();
  if (!t || t === "–" || t === "-" || t === "– di" || t === "nej" || t === "no") return "NONE";
  if (t.includes("stereo") || t === "s") return "STEREO";
  return "MONO"; // "mono", "di", "x", "ja" …
}

/**
 * "Stagebox 7", "SB 7", "AR 7" (→ Stagebox 7), "AB 3" (→ Stagebox 27), "Mixer 2", "M2", or just "7"
 * (stagebox on the SQ, mixer on the Mackie).
 */
export function parseInput(v: string, mixer: Mixer): { inputSource: InputSource | ""; inputNumber: number | null } {
  const none = { inputSource: "" as const, inputNumber: null };
  const m = v.trim().match(/^(stagebox|sb|ar|ab|mixer|mix|m|local|lokal)?\s*(\d{1,2})$/i);
  if (!m) return none;
  const prefix = (m[1] ?? "").toLowerCase();
  let n = +m[2];
  let source: InputSource;
  if (prefix === "ab") {
    source = "STAGEBOX";
    n += 24; // AB168 is chained after the AR2412
  } else if (["stagebox", "sb", "ar"].includes(prefix)) source = "STAGEBOX";
  else if (prefix) source = "MIXER";
  else source = MIXERS[mixer].stagebox ? "STAGEBOX" : "MIXER";
  return n >= 1 && n <= inputLimit(source, mixer) ? { inputSource: source, inputNumber: n } : none;
}

/** Tab/newline separated text → cells. */
export function parseClipboard(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
}

/**
 * Writes pasted cells into the grid from (row, column). A leading column of channel
 * numbers (as copied from most input lists) is recognised and skipped.
 */
export function applyPaste(rows: ChannelRow[], startRow: number, startCol: EditColumn, cells: string[][], mixer: Mixer): ChannelRow[] {
  let data = cells;
  if (startCol === "source" && data.length > 0 && data.every((r) => r.length > 1 && /^\s*\d{1,2}\s*$/.test(r[0]))) {
    data = data.map((r) => r.slice(1));
  }
  const max = MIXERS[mixer].channels;
  const out = rows.map((r) => ({ ...r }));
  const col0 = EDIT_COLUMNS.indexOf(startCol);
  data.forEach((cellsInRow, dr) => {
    const ri = startRow + dr;
    if (ri >= max) return;
    while (out.length <= ri) out.push(emptyRow(out.length + 1));
    cellsInRow.forEach((value, dc) => {
      const col = EDIT_COLUMNS[col0 + dc];
      if (!col) return;
      const r = out[ri];
      if (col === "di") r.di = parseDi(value);
      else if (col === "phantom") r.phantom = truthy(value);
      else if (col === "input") Object.assign(r, parseInput(value, mixer));
      else r[col] = value.trim().slice(0, col === "note" ? 200 : 80);
    });
  });
  return out;
}
