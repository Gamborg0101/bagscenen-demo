import { describe, expect, it } from "vitest";
import { attachmentHeader, formatBytes, isPdf, sanitizeFilename } from "./techrider";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("techrider uploads", () => {
  it("recognises PDFs by their content, not their name", () => {
    expect(isPdf(bytes("%PDF-1.7\n..."))).toBe(true);
    expect(isPdf(bytes("<html><script>"))).toBe(false);
    expect(isPdf(bytes("%PD"))).toBe(false);
    expect(isPdf(bytes(" %PDF-1.7"))).toBe(false);
  });

  it("cleans file names", () => {
    expect(sanitizeFilename("Techrider Bandet 2026.pdf")).toBe("Techrider Bandet 2026.pdf");
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd.pdf");
    expect(sanitizeFilename("C:\\Users\\x\\rider.PDF")).toBe("rider.pdf");
    expect(sanitizeFilename('rider"<script>.pdf')).toBe("rider script.pdf");
    expect(sanitizeFilename("Kør & Æble.pdf")).toBe("Kør Æble.pdf");
    expect(sanitizeFilename("")).toBe("techrider.pdf");
  });

  it("always downloads, with a safe ASCII fallback", () => {
    expect(attachmentHeader("Kør.pdf")).toBe(`attachment; filename="K_r.pdf"; filename*=UTF-8''K%C3%B8r.pdf`);
  });

  it("formats sizes", () => {
    expect([500, 2048, 3.5 * 1024 * 1024].map(formatBytes)).toEqual(["500 B", "2 KB", "3,5 MB"]);
  });
});
