import { useEffect, useState } from "react";
import { Briefcase, GraduationCap, MapPin } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listCareerEntries } from "@/lib/actions/career";
import { imageSrc } from "@/lib/image-src";
import type { CareerEntry } from "@/lib/models";

function formatMonth(date: string | null): string {
  if (!date) return "";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = Number(date.substring(5, 7));
  const year = date.substring(0, 4);
  return month >= 1 && month <= 12 ? `${names[month - 1]} ${year}` : year;
}

function dateRange(e: CareerEntry): string {
  const start = formatMonth(e.start_date);
  const end = e.is_current ? "Present" : formatMonth(e.end_date);
  return [start, end].filter(Boolean).join(" – ");
}

export default function CareerView() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCareerEntries().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  return (
    <ReadPage title="Career" subtitle="Professional history" width="narrow">
      {entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Career and education entries will appear here once added."
        />
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-1.5 top-2 bottom-0 w-0.5" style={{ background: "var(--color-border)" }} />
          <div className="space-y-6">
            {entries.map((entry) => {
              const logo = imageSrc(entry.logo_path);
              const Icon = entry.entry_type === "education" ? GraduationCap : Briefcase;
              const lines = (entry.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
              return (
                <article
                  key={entry.id}
                  className="relative rounded-xl border overflow-hidden"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <span
                    className="absolute -left-[30px] top-5 w-3 h-3 rounded-full"
                    style={{ background: "var(--color-accent)" }}
                  />
                  {logo && (
                    <div className="flex justify-center py-5" style={{ background: "var(--color-surface-2)" }}>
                      <img src={logo} alt={entry.organization} className="h-16 object-contain" loading="lazy" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start gap-2 flex-wrap">
                      {!logo && <Icon size={16} className="mt-1" style={{ color: "var(--color-text-muted)" }} />}
                      <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                        {entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}
                      </h3>
                      {entry.is_current && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full mt-1" style={{ background: "#4A9B6F22", color: "var(--color-success)" }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: "var(--color-text)" }}>{entry.organization}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{dateRange(entry)}</div>
                    {entry.location && (
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        <MapPin size={11} />
                        {entry.location}
                      </div>
                    )}
                    {lines.length > 1 ? (
                      <ul className="mt-3 text-sm space-y-1 list-disc pl-4" style={{ color: "var(--color-text-secondary)" }}>
                        {lines.map((l, i) => (
                          <li key={i}>{l.replace(/^[•\-*]\s*/, "")}</li>
                        ))}
                      </ul>
                    ) : lines.length === 1 ? (
                      <p className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>{lines[0]}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </ReadPage>
  );
}
