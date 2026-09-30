"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DiType, InputSource, Mixer } from "@prisma/client";
import { Label, Segmented } from "@/components/form-controls";
import { buttonClass, inputClass } from "@/components/styles";
import {
  DI_LABEL,
  INPUT_LABEL,
  MIXERS,
  TEMPLATES,
  applyPaste,
  applyTemplate,
  emptyRow,
  inputProblem,
  inputSources,
  isEmptyRow,
  parseClipboard,
  summarize,
  type ChannelRow,
  type EditColumn,
} from "@/lib/channel-plan";
import { deletePlan, savePlan } from "../../actions";

type Props = {
  eventId: string;
  plan: { id: string; kind: "EVENT" | "BAND"; name: string; mixer: Mixer; version: string };
  initialRows: ChannelRow[];
};

const cell = "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm focus:border-fg focus:bg-field focus:outline-none";

export function ChannelEditor({ eventId, plan, initialRows }: Props) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [mixer, setMixer] = useState<Mixer>(plan.mixer);
  const [rows, setRows] = useState<ChannelRow[]>(() => padRows(initialRows, plan.mixer));
  const [version, setVersion] = useState(plan.version);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const grid = useRef<HTMLTableElement>(null);

  const max = MIXERS[mixer].channels;
  const summary = summarize(rows);
  const overLimit = rows.filter((r) => r.number > max && !isEmptyRow(r));
  const sources = inputSources(mixer);
  const inputProblems = rows.flatMap((r) => (isEmptyRow(r) ? [] : [inputProblem(r, mixer)].filter((x): x is string => !!x)));

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    // Links inside the app ("Vis / print", the menu …): ask before leaving unsaved changes.
    const intercept = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.hasAttribute("download") || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  function change(next: ChannelRow[]) {
    setRows(next);
    setDirty(true);
    setMessage({});
  }

  function update(i: number, patch: Partial<ChannelRow>) {
    change(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function focusCell(row: number, col: string) {
    grid.current?.querySelector<HTMLElement>(`[data-r="${row}"][data-c="${col}"]`)?.focus();
  }

  // Spreadsheet-like movement: Enter/↓ next row, ↑ previous row (same column).
  function onKeyDown(e: React.KeyboardEvent<HTMLElement>, i: number, col: string) {
    const isSelect = e.currentTarget.tagName === "SELECT";
    if (e.key === "Enter" || (!isSelect && e.key === "ArrowDown")) {
      e.preventDefault();
      if (i + 1 >= rows.length && rows.length < max) change([...rows, emptyRow(rows.length + 1)]);
      setTimeout(() => focusCell(i + 1, col));
    } else if (!isSelect && e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      focusCell(i - 1, col);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, i: number, col: EditColumn) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return; // single value: normal paste
    e.preventDefault();
    change(applyPaste(rows, i, col, parseClipboard(text), mixer));
  }

  /** Saves; then goes to `next` if given. */
  function save(next?: string) {
    setMessage({});
    start(async () => {
      const res = await savePlan(plan.id, { name, mixer, channels: rows, version }).catch(() => ({ error: "Der skete en fejl. Prøv igen." }) as const);
      if ("error" in res && res.error) {
        setLeaveTo(null);
        return setMessage({ error: res.error });
      }
      if ("version" in res && res.version) setVersion(res.version);
      setDirty(false);
      setMessage({ ok: "Gemt" });
      if (next) router.push(next);
      else router.refresh();
    });
  }

  function leaveWithoutSaving() {
    const next = leaveTo;
    setDirty(false);
    setLeaveTo(null);
    if (next) setTimeout(() => router.push(next));
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-3 sm:grid-cols-2">
        {plan.kind === "BAND" ? (
          <div>
            <Label htmlFor="plan-name">Band</Label>
            <input
              id="plan-name"
              className={inputClass}
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </div>
        ) : (
          <div>
            <Label>Plan</Label>
            <p className="py-2 font-medium">Arrangementet</p>
          </div>
        )}
        <div>
          <Label>Mixer</Label>
          <Segmented
            label="Mixer"
            value={mixer}
            onChange={(m) => {
              setMixer(m);
              setRows((r) => padRows(r, m));
              setDirty(true);
            }}
            options={(Object.keys(MIXERS) as Mixer[]).map((m) => ({ value: m, label: m === "MACKIE" ? "Mackie" : m }))}
          />
        </div>
      </div>

      <div>
        <Label>Skabeloner</Label>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs hover:bg-subtle"
              onClick={() => change(applyTemplate(rows, t.rows, max))}
            >
              + {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Tip: kopiér en inputliste fra Excel eller Google Sheets og indsæt den i en celle.</p>
      </div>

      {/* Live summary and warnings */}
      <div className="space-y-1 text-xs">
        <p className="text-muted">
          {summary.channels} kanaler · {summary.monoDi} mono DI · {summary.stereoDi} stereo DI · 48V på {summary.phantom}
        </p>
        {summary.duplicateInputs.length > 0 && <p className="font-semibold text-danger">Samme input bruges to gange: {summary.duplicateInputs.join(", ")}</p>}
        {overLimit.length > 0 && (
          <p className="font-semibold text-danger">
            {MIXERS[mixer].label} har kun {max} kanaler — kanal {overLimit.map((r) => r.number).join(", ")} kan ikke gemmes.
          </p>
        )}
        {inputProblems.map((p) => (
          <p key={p} className="font-semibold text-danger">
            {p}
          </p>
        ))}
      </div>

      {/* The grid */}
      <div className="-mx-4 overflow-x-auto px-4 lg:-mx-24 xl:-mx-40">
        <table ref={grid} className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-fg text-left text-xs text-muted">
              <th className="w-12 py-1.5 pr-1 text-right">Kanal</th>
              <th className="w-[22%] px-1.5 py-1.5">Kilde</th>
              <th className="w-[20%] px-1.5 py-1.5">Mikrofon</th>
              <th className="w-28 px-1.5 py-1.5">DI</th>
              <th className="w-12 px-1.5 py-1.5 text-center">48V</th>
              <th className="w-40 px-1.5 py-1.5">Input</th>
              <th className="px-1.5 py-1.5">Note</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.number} className={`border-b border-line ${r.number > max ? "bg-danger/10" : ""}`}>
                <td className="py-0.5 pr-1 text-right font-semibold tabular-nums">{r.number}</td>
                <td className="px-0.5 py-0.5">
                  <input
                    aria-label={`Kilde kanal ${r.number}`}
                    data-r={i}
                    data-c="source"
                    className={cell}
                    value={r.source}
                    maxLength={80}
                    placeholder={i === 0 ? "Kick in" : undefined}
                    onChange={(e) => update(i, { source: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, "source")}
                    onPaste={(e) => onPaste(e, i, "source")}
                  />
                </td>
                <td className="px-0.5 py-0.5">
                  <input
                    aria-label={`Mikrofon kanal ${r.number}`}
                    data-r={i}
                    data-c="gear"
                    className={cell}
                    value={r.gear}
                    maxLength={80}
                    onChange={(e) => update(i, { gear: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, "gear")}
                    onPaste={(e) => onPaste(e, i, "gear")}
                  />
                </td>
                <td className="px-0.5 py-0.5">
                  <select
                    aria-label={`DI kanal ${r.number}`}
                    data-r={i}
                    data-c="di"
                    className={cell}
                    value={r.di}
                    onChange={(e) => update(i, { di: e.target.value as DiType })}
                    onKeyDown={(e) => onKeyDown(e, i, "di")}
                  >
                    {(Object.keys(DI_LABEL) as DiType[]).map((d) => (
                      <option key={d} value={d}>
                        {DI_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-0.5 py-0.5 text-center">
                  <input
                    type="checkbox"
                    aria-label={`48V kanal ${r.number}`}
                    data-r={i}
                    data-c="phantom"
                    className="size-4 accent-current"
                    checked={r.phantom}
                    onChange={(e) => update(i, { phantom: e.target.checked })}
                    onKeyDown={(e) => onKeyDown(e, i, "phantom")}
                  />
                </td>
                <td className="px-0.5 py-0.5">
                  <div className="flex gap-1">
                    <select
                      aria-label={`Inputtype kanal ${r.number}`}
                      data-r={i}
                      data-c="inputSource"
                      className={`${cell} w-auto!`}
                      value={r.inputSource}
                      onChange={(e) => update(i, { inputSource: e.target.value as InputSource | "", ...(e.target.value ? {} : { inputNumber: null }) })}
                      onKeyDown={(e) => onKeyDown(e, i, "inputSource")}
                    >
                      <option value="">–</option>
                      {sources.map((src) => (
                        <option key={src} value={src}>
                          {INPUT_LABEL[src]}
                        </option>
                      ))}
                      {r.inputSource && !sources.includes(r.inputSource) && <option value={r.inputSource}>{INPUT_LABEL[r.inputSource]}</option>}
                    </select>
                    <input
                      aria-label={`Inputnummer kanal ${r.number}`}
                      data-r={i}
                      data-c="inputNumber"
                      inputMode="numeric"
                      maxLength={2}
                      className={`${cell} w-12 tabular-nums ${!isEmptyRow(r) && inputProblem(r, mixer) ? "text-danger" : ""}`}
                      value={r.inputNumber ?? ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                        // Typing a number without a type picks the obvious one (Stagebox on the SQ, Mixer on the Mackie).
                        update(i, { inputNumber: digits ? +digits : null, inputSource: r.inputSource || (digits ? sources[0] : "") });
                      }}
                      onKeyDown={(e) => onKeyDown(e, i, "inputNumber")}
                      onPaste={(e) => onPaste(e, i, "input")}
                    />
                  </div>
                </td>
                <td className="px-0.5 py-0.5">
                  <input
                    aria-label={`Note kanal ${r.number}`}
                    data-r={i}
                    data-c="note"
                    className={cell}
                    value={r.note}
                    maxLength={200}
                    onChange={(e) => update(i, { note: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, "note")}
                    onPaste={(e) => onPaste(e, i, "note")}
                  />
                </td>
                <td className="py-0.5 text-center">
                  {!isEmptyRow(r) && (
                    <button
                      type="button"
                      aria-label={`Ryd kanal ${r.number}`}
                      className="grid size-7 place-items-center rounded text-muted hover:bg-subtle hover:text-danger"
                      onClick={() => update(i, { ...emptyRow(r.number) })}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {rows.length < max && (
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => change([...rows, ...extra(rows.length, 4, max)])}>
            + 4 kanaler
          </button>
        )}
        {rows.length < max && (
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => change([...rows, ...extra(rows.length, max - rows.length, max)])}>
            Vis alle {max}
          </button>
        )}
      </div>

      <div className="border-t border-line pt-6">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-danger">Slet kanalplanen for {name}?</span>
            <button type="button" className={buttonClass("danger", "sm")} disabled={pending} onClick={() => start(async () => void (await deletePlan(plan.id)))}>
              Ja, slet
            </button>
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setConfirmDelete(false)}>
              Annullér
            </button>
          </div>
        ) : (
          <button type="button" className={buttonClass("danger", "sm")} onClick={() => setConfirmDelete(true)}>
            Slet kanalplan
          </button>
        )}
      </div>

      {/* Leaving with unsaved changes */}
      {leaveTo && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-fg/30 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-bg p-4 shadow-lg">
            <p id="leave-title" className="font-medium">
              Vil du gemme dine ændringer?
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass("primary")} disabled={pending} onClick={() => save(leaveTo)}>
                {pending ? "Gemmer …" : "Gem"}
              </button>
              <button type="button" className={buttonClass("secondary")} onClick={leaveWithoutSaving}>
                Gem ikke
              </button>
              <button type="button" className={buttonClass("secondary")} onClick={() => setLeaveTo(null)}>
                Annullér
              </button>
            </div>
            {message.error && <p className="text-xs text-danger">{message.error}</p>}
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href={`/arrangementer/${eventId}/kanalplan/${plan.id}`} className="text-xs text-muted underline underline-offset-2">
            Vis / print
          </a>
          <span className={`ml-auto text-xs ${message.error ? "text-danger" : "text-ok"}`}>{message.error ?? message.ok ?? (dirty ? "Ikke gemt" : "")}</span>
          <button type="button" disabled={pending || overLimit.length > 0 || inputProblems.length > 0} className={`${buttonClass("primary")} min-w-24`} onClick={() => save()}>
            {pending ? "Gemmer …" : "Gem"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Channels 1…n with room to type: at least 12, or the last used channel + 4 (within the mixer's limit). */
function padRows(rows: ChannelRow[], mixer: Mixer): ChannelRow[] {
  const max = MIXERS[mixer].channels;
  const lastUsed = rows.reduce((m, r) => (isEmptyRow(r) ? m : Math.max(m, r.number)), 0);
  // Channels above the limit that hold data stay visible (marked red) so nothing is lost silently.
  const length = Math.max(Math.min(max, Math.max(12, lastUsed + 4, rows.length)), lastUsed);
  const byNumber = new Map(rows.map((r) => [r.number, r]));
  return Array.from({ length }, (_, i) => byNumber.get(i + 1) ?? emptyRow(i + 1));
}

function extra(from: number, count: number, max: number): ChannelRow[] {
  return Array.from({ length: Math.max(0, Math.min(count, max - from)) }, (_, i) => emptyRow(from + i + 1));
}
