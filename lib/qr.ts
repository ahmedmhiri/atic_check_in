import QRCode from "qrcode";
import { randomBytes } from "crypto";

/** Generate a unique, URL-safe token to embed in a student's QR code. */
export function generateQrToken(): string {
  return randomBytes(16).toString("hex");
}

/** Render a token to a PNG Buffer (for badges / ZIP export). */
export async function qrPngBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}

/** Render a token to a data URL (for inline display in the UI). */
export async function qrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 2, width: 256 });
}
