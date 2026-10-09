import { useEffect, useState } from "react";
import { dateToParts, partsToDate, type DateParts, type DatePrecision } from "@/lib/date-parts";

interface DatePrecisionInputProps {
  /** Stored date (ISO) or null. */
  date: string | null | undefined;
  precision: DatePrecision | string | null | undefined;
  /** Called with the new stored date + precision; `date` is null while the year is empty or invalid. */
  onChange: (value: { date: string | null; precision: DatePrecision }) => void;
  label?: string;
  required?: boolean;
  /** Hide the day picker (career dates are month + year only). */
  showDay?: boolean;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Year (required) + optional month + optional day. Leaving month/day blank sets the precision, like the web editor. */
export default function DatePrecisionInput({ date, precision, onChange, label = "Date", required, showDay = true }: DatePrecisionInputProps) {
  const [parts, setParts] = useState<DateParts>(() => dateToParts(date, precision));

  // Re-sync when a different record is loaded into the form. Skipped when the incoming value is
  // just what the user's own typing produced, so half-typed input (e.g. year "2") isn't erased.
  useEffect(() => {
    setParts((current) => {
      // Mid-typing a year (1-3 digits): the user's own input is not a date yet, don't overwrite it.
      if (current.year.length > 0 && current.year.length < 4) return current;
      const mine = partsToDate(current);
      const sameDate = mine.date === (date ?? null);
      const samePrecision = mine.date === null || mine.precision === (precision ?? "day").toString().toLowerCase();
      return sameDate && samePrecision ? current : dateToParts(date, precision);
    });
  }, [date, precision]);

  function update(next: DateParts) {
    // A day only makes sense with a month.
    if (!next.month || !showDay) next = { ...next, day: "" };
    setParts(next);
    // Don't report half-typed years (e.g. "20") as dates; wait for four digits or an empty field.
    if (next.year.length > 0 && next.year.length < 4) return;
    onChange(partsToDate(next));
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const invalid = parts.year !== "" && partsToDate(parts).date === null;
  const days = parts.month ? new Date(Date.UTC(Number(parts.year) || 2000, Number(parts.month), 0)).getUTCDate() : 31;

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {label}
        {required && " *"}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          placeholder="Year"
          value={parts.year}
          onChange={(e) => update({ ...parts, year: e.target.value })}
          className="w-24 px-3 py-2 rounded-lg border text-sm"
          style={field}
          aria-label={`${label} year`}
        />
        <select value={parts.month} onChange={(e) => update({ ...parts, month: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border text-sm" style={field} aria-label={`${label} month`}>
          <option value="">Month (opt.)</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        {showDay && <select value={parts.day} onChange={(e) => update({ ...parts, day: e.target.value })} disabled={!parts.month} className="w-28 px-3 py-2 rounded-lg border text-sm disabled:opacity-50" style={field} aria-label={`${label} day`}>
          <option value="">Day (opt.)</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>}
      </div>
      {invalid && (
        <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>
          That is not a valid date.
        </p>
      )}
    </div>
  );
}
