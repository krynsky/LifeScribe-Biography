export type DatePrecision = "year" | "month" | "day";

export interface DateParts {
  year: string;
  month: string; // "" or "1".."12"
  day: string; // "" or "1".."31"
}

export interface PartialDate {
  /** ISO date at the stored precision's resolution ("2017-02-01" for February 2017), or null when empty/invalid. */
  date: string | null;
  precision: DatePrecision;
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Turn year/month/day pickers into a stored date + precision, the way the web editor does:
 * leave the day blank for "month" precision, month and day blank for "year" precision.
 * A day with no month is ignored. Invalid values (e.g. Feb 30) yield `date: null`.
 */
export function partsToDate(parts: DateParts): PartialDate {
  const y = Number(parts.year);
  if (!parts.year.trim() || !Number.isInteger(y) || y < 1 || y > 9999) return { date: null, precision: "year" };
  const m = parts.month ? Number(parts.month) : 0;
  const d = parts.day ? Number(parts.day) : 0;
  if (!m) return { date: `${String(y).padStart(4, "0")}-01-01`, precision: "year" };
  if (m < 1 || m > 12) return { date: null, precision: "month" };
  if (!d) return { date: `${String(y).padStart(4, "0")}-${pad(m)}-01`, precision: "month" };
  if (d < 1 || d > daysIn(y, m)) return { date: null, precision: "day" };
  return { date: `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`, precision: "day" };
}

/** Split a stored date + precision back into picker values (parts below the precision are blank). */
export function dateToParts(date: string | null | undefined, precision: string | null | undefined): DateParts {
  if (!date) return { year: "", month: "", day: "" };
  const year = String(Number(date.substring(0, 4)) || "");
  const month = Number(date.substring(5, 7)) || 0;
  const day = Number(date.substring(8, 10)) || 0;
  const p = (precision ?? "day").toLowerCase();
  return {
    year,
    month: p === "year" || !month ? "" : String(month),
    day: p === "day" && day ? String(day) : "",
  };
}
