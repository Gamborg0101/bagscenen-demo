import type { Shift } from "@prisma/client";
import type { ShiftCoverage, Window } from "@/lib/coverage";
import { formatRange, formatTime } from "@/lib/datetime";
import { axisFor, barFor, pct, ticks, type Axis } from "@/lib/timeline";

type HelperRow = { id: string; name: string; windows: Window[]; isYou?: boolean };

/**
 * One timeline for the whole event: the shifts, one row per helper who said yes,
 * and a red "Mangler (n)" row where fewer people are present than needed.
 */
export function CoverageTimeline({
  shifts,
  coverage,
  helpers,
}: {
  shifts: Shift[];
  coverage: Map<string, ShiftCoverage>;
  helpers: HelperRow[];
}) {
  const shiftRanges = shifts.map((s) => coverage.get(s.id)!.range);
  const helperRanges = helpers.flatMap((h) => h.windows.filter((w) => w.end).map((w) => ({ start: w.start, end: w.end! })));
  const axis = axisFor([...shiftRanges, ...helperRanges]);
  // Only worth showing once someone has taken a shift.
  if (!axis || helpers.length === 0) return null;

  const gaps = shifts.flatMap((s) => coverage.get(s.id)!.gaps.map((g) => ({ ...g, need: s.helpersNeeded, key: `${s.id}-${+g.start}` })));
  const missing = Math.max(0, ...gaps.map((g) => g.need - g.have));

  return (
    <figure className="space-y-1.5" aria-label="Tidslinje over hvem der er på">
      <Row label="">
        <div className="relative h-4 text-[10px] text-muted tabular-nums">
          {ticks(axis).map((t, i, all) => (
            <span
              key={+t}
              className="absolute top-0"
              style={{ left: `${pct(axis, t)}%`, transform: i === 0 ? "none" : i === all.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {formatTime(t).replace(".00", "")}
            </span>
          ))}
        </div>
      </Row>

      {helpers.map((h) => (
        <Row key={h.id} label={h.name} strong={h.isYou}>
          <Track axis={axis}>
            {h.windows.map((w, i) => {
              const bar = barFor(axis, w);
              if (!bar) return null;
              return (
                <div
                  key={i}
                  title={`${h.name}: ${formatRange(w.start, w.end, "færdig")}`}
                  className="absolute top-1.5 h-3 rounded-sm"
                  style={{
                    left: `${bar.left}%`,
                    width: `${bar.width}%`,
                    background: bar.openEnd ? "linear-gradient(to right, var(--fg) 60%, transparent)" : "var(--fg)",
                  }}
                />
              );
            })}
          </Track>
        </Row>
      ))}

      {gaps.length > 0 && (
        <Row label={`Mangler (${missing})`} danger>
          <Track axis={axis}>
            {gaps.map((g) => {
              const bar = barFor(axis, g)!;
              return (
                <div
                  key={g.key}
                  title={`Mangler ${g.need - g.have} ${formatRange(g.start, g.end)} (${g.have} af ${g.need})`}
                  className="absolute top-1.5 h-3 rounded-sm bg-danger/80 text-center text-[9px] leading-3 text-bg"
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                >
                  {bar.width > 6 ? `−${g.need - g.have}` : ""}
                </div>
              );
            })}
          </Track>
        </Row>
      )}

    </figure>
  );
}

function Row({ label, strong, danger, children }: { label: string; strong?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-16 shrink-0 truncate text-xs ${danger ? "text-danger" : strong ? "font-medium" : "text-muted"}`}
        title={label}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Track({ axis, children }: { axis: Axis; children: React.ReactNode }) {
  return (
    <div className="relative h-6 rounded-sm bg-subtle/60">
      {ticks(axis).map((t) => (
        <div key={+t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(axis, t)}%` }} />
      ))}
      {children}
    </div>
  );
}
