import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let planContentHash: typeof import("./plan-share").planContentHash;
beforeAll(async () => {
  ({ planContentHash } = await import("./plan-share"));
});

const ch = (number: number, source: string) => ({ number, source, gear: null, di: "NONE", phantom: false, inputSource: "STAGEBOX", inputNumber: number, note: null });

describe("planContentHash", () => {
  const plan = { name: "Band", mixer: "SQ7", channels: [ch(1, "Kick"), ch(2, "Snare")] };

  it("is the same for the same content, whatever the row order", () => {
    expect(planContentHash(plan)).toBe(planContentHash({ ...plan, channels: [...plan.channels].reverse() }));
  });

  it("changes when anything shown on the plan changes", () => {
    const base = planContentHash(plan);
    expect(planContentHash({ ...plan, channels: [ch(1, "Kick"), ch(2, "Snare top")] })).not.toBe(base);
    expect(planContentHash({ ...plan, channels: [ch(1, "Kick"), { ...ch(2, "Snare"), phantom: true }] })).not.toBe(base);
    expect(planContentHash({ ...plan, mixer: "SQ5" })).not.toBe(base);
    expect(planContentHash({ ...plan, channels: [ch(1, "Kick")] })).not.toBe(base);
  });
});
