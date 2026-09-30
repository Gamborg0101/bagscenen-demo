import { buttonClass, inputClass } from "@/components/styles";
import { addHelper } from "../actions";

/** The coordinator puts a named helper on the event (e.g. agreed by phone), then picks shifts with "Ret vagter". */
export function AddHelper({ eventId, candidates }: { eventId: string; candidates: { id: string; name: string }[] }) {
  if (candidates.length === 0) return null;
  return (
    <form action={addHelper} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <select name="userId" required defaultValue="" className={`${inputClass} w-auto! min-w-48`} aria-label="Medhjælper">
        <option value="" disabled>
          Vælg medhjælper …
        </option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button className={buttonClass("secondary")}>Sæt på arrangementet</button>
    </form>
  );
}
