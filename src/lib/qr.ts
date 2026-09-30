import "server-only";
import QRCode from "qrcode";

/** QR code as an inline SVG string. Black on white in both themes, so it always scans. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
}
