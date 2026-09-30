import type { Event } from "@prisma/client";
import { RAILING_ABOVE_CM } from "./form";
import { LIGHTING_LABEL } from "./labels";

export type RequirementSection = { title: string; items: string[]; notes: string[]; warnings: string[] };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Turns the requirement columns into readable Danish lines, skipping empty sections. */
export function requirementSections(e: Event): RequirementSection[] {
  const sections: RequirementSection[] = [];
  const push = (title: string, items: (string | false | null | undefined)[], notes: (string | null)[] = [], warnings: (string | false)[] = []) => {
    const i = items.filter((x): x is string => !!x);
    const n = notes.filter((x): x is string => !!x);
    const w = warnings.filter((x): x is string => !!x);
    if (i.length || n.length || w.length) sections.push({ title, items: i, notes: n, warnings: w });
  };

  if (e.needsStage) {
    const stage = [e.stageSize && `Scene ${e.stageSize} m`, e.podiumHeightCm && `ben ${e.podiumHeightCm} cm`].filter(Boolean).join(", ");
    push("Scene / podier", [stage || "Scene / podier", e.lectern && "Talerstol"], [e.stageNotes], [
      (e.podiumHeightCm ?? 0) > RAILING_ABOVE_CM && "HUSK SIDERÆLING",
    ]);
  }

  push("Projektor / lyd fra computer", [e.projector && "Projektor", e.pcAudio && "Lyd fra computer"]);

  push(
    "Lyd",
    [
      e.handheldMics > 0 && plural(e.handheldMics, "håndholdt mikrofon", "håndholdte mikrofoner"),
      e.headsetMics > 0 && `${e.headsetMics} headset / beltpack`,
      e.micPurpose && `Til: ${e.micPurpose}`,
      e.bands && (e.bandCount ? plural(e.bandCount, "band", "bands") : "Bands"),
    ],
    [e.techRiderNotes, e.soundNotes],
  );

  push("Lys", [e.lightingPreset !== "INGEN" && `${LIGHTING_LABEL[e.lightingPreset]}-lys`], [e.lightingNotes]);

  push(
    "Stole / borde",
    [e.chairs != null && `${e.chairs} stole`, e.tables != null && plural(e.tables, "bord", "borde")],
    [e.otherFurniture],
  );

  if (e.foyerUsed) {
    const podiumDetails = [e.foyerPodiumSize && `${e.foyerPodiumSize} m`, e.foyerPodiumHeightCm && `ben ${e.foyerPodiumHeightCm} cm`].filter(Boolean).join(", ");
    push("Foyer", [
      e.foyerPodiums > 0 && plural(e.foyerPodiums, "podie", "podier") + (podiumDetails ? ` (${podiumDetails})` : ""),
      e.foyerMics > 0 && plural(e.foyerMics, "mikrofon", "mikrofoner"),
      e.foyerSound && "Lyd fra anlægget",
      e.foyerTables > 0 && plural(e.foyerTables, "letvægtsbord", "letvægtsborde"),
    ], [], [(e.foyerPodiumHeightCm ?? 0) > RAILING_ABOVE_CM && "HUSK SIDERÆLING"]);
  }

  push("Andet", [], [e.extraNotes]);

  return sections;
}
