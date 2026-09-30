// Rules for techrider uploads. Pure module — used by the upload route and tests.

/** Vercel accepts request bodies up to 4.5 MB; techriders are almost always far smaller. */
export const TECHRIDER_MAX_BYTES = 4 * 1024 * 1024;

/** A real PDF starts with "%PDF-" — the file name or browser-reported type is not trusted. */
export function isPdf(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
}

/** Keeps a readable, harmless file name: no paths, control characters or odd symbols; always ".pdf". */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N} ._()-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${cleaned || "techrider"}.pdf`;
}

/** Content-Disposition that always downloads, with an ASCII fallback and the UTF-8 name. */
export function attachmentHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
