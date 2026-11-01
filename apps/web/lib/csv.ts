export type CsvCell = string | number | null | undefined;

// Spreadsheet apps run text starting with these characters as a formula.
const FORMULA_PREFIX = /^\s*[=+\-@]/;

function encodeCell(cell: CsvCell): string {
  if (cell == null) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  const text = FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV. The UTF-8 BOM is what makes Excel read Arabic text correctly. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(encodeCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some mobile browsers read the blob after click() returns, so keep it alive for a while.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
