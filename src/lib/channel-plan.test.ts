import { describe, expect, it } from "vitest";
import {
  TEMPLATES,
  applyPaste,
  applyTemplate,
  emptyRow,
  inputProblem,
  inputSources,
  parseClipboard,
  parseDi,
  parseInput,
  planSaveSchema,
  rowsToDb,
  summarize,
  type ChannelRow,
} from "./channel-plan";

const rows = (n: number) => Array.from({ length: n }, (_, i) => emptyRow(i + 1));
const tpl = (key: string) => TEMPLATES.find((t) => t.key === key)!.rows;
const input = (r: ChannelRow) => [r.inputSource, r.inputNumber];

describe("inputs per mixer", () => {
  it("SQ has Stagebox (1–40) and Mixer; Mackie only Mixer (1–8)", () => {
    expect(inputSources("SQ7")).toEqual(["STAGEBOX", "MIXER"]);
    expect(inputSources("MACKIE")).toEqual(["MIXER"]);
    const r = (inputSource: "STAGEBOX" | "MIXER", inputNumber: number) => ({ number: 1, inputSource, inputNumber });
    expect(inputProblem(r("STAGEBOX", 40), "SQ7")).toBeNull();
    expect(inputProblem(r("STAGEBOX", 41), "SQ7")).toContain("1–40");
    expect(inputProblem(r("MIXER", 17), "SQ5")).toContain("1–16");
    expect(inputProblem(r("STAGEBOX", 1), "MACKIE")).toContain("ingen stagebox");
    expect(inputProblem({ number: 3, inputSource: "MIXER", inputNumber: null }, "SQ7")).toContain("inputnummer");
  });

  it("parses typed/pasted inputs, incl. AB168 numbers after the AR2412", () => {
    const p = (v: string) => Object.values(parseInput(v, "SQ7"));
    expect(["Stagebox 7", "SB7", "AR 7", "AB 3", "Mixer 2", "M2", "7", "AB 17", "x"].map(p)).toEqual([
      ["STAGEBOX", 7], ["STAGEBOX", 7], ["STAGEBOX", 7], ["STAGEBOX", 27], ["MIXER", 2], ["MIXER", 2], ["STAGEBOX", 7], ["", null], ["", null],
    ]);
    expect(parseInput("7", "MACKIE")).toEqual({ inputSource: "MIXER", inputNumber: 7 });
    expect(parseInput("SB 3", "MACKIE")).toEqual({ inputSource: "", inputNumber: null });
  });
});

describe("templates", () => {
  it("fill the first empty channels", () => {
    const start = rows(8);
    start[0] = { ...start[0], source: "Speak" };
    const out = applyTemplate(start, tpl("keys-stereo"), 48);
    expect(out.slice(0, 3).map((r) => [r.number, r.source, r.di])).toEqual([
      [1, "Speak", "NONE"],
      [2, "Keys L", "STEREO"],
      [3, "Keys R", "STEREO"],
    ]);
  });

  it("bass is DI only", () => {
    expect(tpl("bass")).toEqual([{ source: "Bas", di: "MONO" }]);
  });

  it("add channels when needed but never past the mixer's limit", () => {
    expect(applyTemplate(rows(4), tpl("drums"), 48)).toHaveLength(10);
    expect(applyTemplate(rows(4), tpl("drums"), 8)).toHaveLength(8);
  });
});

describe("paste from a spreadsheet", () => {
  it("skips a leading channel-number column and maps the rest", () => {
    const cells = parseClipboard("1\tKick in\tBeta 91A\t\tx\tSB 1\n2\tKeys L\t\tstereo\t\tMixer 2\t");
    const out = applyPaste(rows(8), 0, "source", cells, "SQ7");
    expect(out.slice(0, 2).map((r) => [r.source, r.gear, r.di, r.phantom, ...input(r)])).toEqual([
      ["Kick in", "Beta 91A", "NONE", true, "STAGEBOX", 1],
      ["Keys L", "", "STEREO", false, "MIXER", 2],
    ]);
  });

  it("pastes from the clicked cell and column", () => {
    const out = applyPaste(rows(8), 3, "gear", parseClipboard("SM57\nSM58"), "SQ7");
    expect([out[3].gear, out[4].gear, out[3].source]).toEqual(["SM57", "SM58", ""]);
  });

  it("reads DI values", () => {
    expect(["", "-", "– DI", "mono", "DI", "x", "Stereo", "s"].map(parseDi)).toEqual(["NONE", "NONE", "NONE", "MONO", "MONO", "MONO", "STEREO", "STEREO"]);
  });
});

describe("summary", () => {
  it("counts channels, DI boxes (stereo = one box per pair), 48V and duplicate inputs", () => {
    const r: ChannelRow[] = [
      { ...emptyRow(1), source: "Kick", inputSource: "STAGEBOX", inputNumber: 1 },
      { ...emptyRow(2), source: "OH L", phantom: true, inputSource: "STAGEBOX", inputNumber: 1 },
      { ...emptyRow(3), source: "Keys L", di: "STEREO" },
      { ...emptyRow(4), source: "Keys R", di: "STEREO" },
      { ...emptyRow(5), source: "Bas", di: "MONO" },
      emptyRow(6),
    ];
    expect(summarize(r)).toEqual({ channels: 5, monoDi: 1, stereoDi: 1, phantom: 1, duplicateInputs: ["Stagebox 1 (kanal 1 og 2)"] });
  });
});

describe("saving", () => {
  const plan = (mixer: "SQ7" | "MACKIE", channels: ChannelRow[]) => planSaveSchema.safeParse({ name: "Band", mixer, channels, version: "" });

  it("rejects channels and inputs the mixer doesn't have", () => {
    expect(plan("MACKIE", [{ ...emptyRow(9), source: "Vokal" }]).success).toBe(false);
    expect(plan("MACKIE", [{ ...emptyRow(1), source: "Vokal", inputSource: "STAGEBOX", inputNumber: 1 }]).success).toBe(false);
    expect(plan("SQ7", [{ ...emptyRow(40), source: "Vokal", inputSource: "STAGEBOX", inputNumber: 40 }]).success).toBe(true);
    expect(plan("SQ7", [{ ...emptyRow(1), source: "Vokal", inputSource: "MIXER", inputNumber: null }]).success).toBe(false);
  });

  it("keeps only filled rows", () => {
    const r = [{ ...emptyRow(1), source: " Kick ", inputSource: "STAGEBOX" as const, inputNumber: 3 }, emptyRow(2)];
    expect(rowsToDb(r)).toEqual([
      { number: 1, source: "Kick", gear: null, di: "NONE", phantom: false, inputSource: "STAGEBOX", inputNumber: 3, note: null },
    ]);
  });
});
