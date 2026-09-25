import * as XLSX from "xlsx";

/** Read the first sheet. CSVs are decoded as UTF-8 explicitly (Google Forms
 *  exports have no BOM, and codepage guessing garbles accented names). */
export function readSheet(buf: Buffer): Record<string, unknown>[] {
  const isZip = buf.length > 1 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" = .xlsx
  const wb = isZip
    ? XLSX.read(buf, { type: "buffer" })
    : XLSX.read(buf.toString("utf8").replace(/^\u{FEFF}/u, ""), { type: "string", raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}
