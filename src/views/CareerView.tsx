import { useEffect, useState } from "react";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import CategoryChip from "@/components/reader/CategoryChip";
import { AlbumChips, StoryChips, useLinkTargets } from "@/components/reader/LinkedChips";
import { getBiography } from "@/lib/actions/biography";
import { listCareerEntries } from "@/lib/actions/career";
import { imageSrc } from "@/lib/image-src";
import { computeDuration, formatMonthYear, parseLinked } from "@/lib/reader-utils";
import type { CareerEntry } from "@/lib/models";

export default function CareerView() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [siteTitle, setSiteTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const links = useLinkTargets();

  useEffect(() => {
    Promise.all([listCareerEntries(), getBiography()])
      .then(([e, b]) => {
        setEntries(e);
        setSiteTitle(b?.title ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  return (
    <ReadPage title="Career" subtitle={siteTitle ? `Professional history of ${siteTitle}` : "Professional history"} width="timeline">
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-20 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <p className="text-4xl">💼</p>
          <p className="mt-3">No career history has been added yet.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute bottom-2 left-5 top-2 w-px" style={{ background: "var(--color-border)" }} aria-hidden />
          <div className="space-y-8">
            {entries.map((entry) => {
              const logo = imageSrc(entry.logo_path);
              const range = `${formatMonthYear(entry.start_date)} – ${
                entry.is_current ? "Present" : entry.end_date ? formatMonthYear(entry.end_date) : "?"
              }`;
              const duration = computeDuration(entry.start_date, entry.end_date, !!entry.is_current);
              return (
                <div key={entry.id} className="relative flex gap-5">
                  {logo ? (
                    <div className="relative z-10 ml-4 mt-4 h-3 w-3 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
                  ) : (
                    <div
                      className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold shadow-sm ring-2"
                      style={{ background: "#fff", color: "var(--color-primary)", ["--tw-ring-color" as string]: "rgba(212,168,106,0.3)" }}
                    >
                      {entry.organization.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div
                    className="min-w-0 flex-1 overflow-hidden rounded-xl border"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border-light)", boxShadow: "var(--shadow-card)" }}
                  >
                    {logo && (
                      <div className="flex items-center justify-center border-b p-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>
                        <img src={logo} alt={`${entry.organization} logo`} className="h-20 object-contain" style={{ maxWidth: 200 }} loading="lazy" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                          {entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}
                        </h2>
                        {!!entry.is_current && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#f0fdf4", color: "#15803d", boxShadow: "inset 0 0 0 1px #bbf7d0" }}>
                            Current
                          </span>
                        )}
                        <CategoryChip variant="solid" name={entry.category} color={entry.category_color} icon={entry.category_icon} />
                      </div>

                      <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        {entry.organization}
                        {entry.employment_type && (
                          <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-muted)" }}>
                            · {entry.employment_type}
                          </span>
                        )}
                      </p>

                      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {range}
                        {duration && (
                          <>
                            <span className="mx-1.5">·</span>
                            {duration}
                          </>
                        )}
                      </p>

                      {entry.location && (
                        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>📍 {entry.location}</p>
                      )}

                      {entry.description && (
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          {entry.description}
                        </p>
                      )}

                      <AlbumChips refs={parseLinked(entry.linked_albums)} ids={links.albums} />
                      <StoryChips refs={parseLinked(entry.linked_stories)} ids={links.stories} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ReadPage>
  );
}
