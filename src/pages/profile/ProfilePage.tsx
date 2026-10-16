import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import ImagePicker from "@/components/forms/ImagePicker";
import { getBiography, updateBiography } from "@/lib/actions/biography";
import { PROFILE_LIMITS, isProfileDirty, profileToColumns, profileToForm, validateProfile, type ProfileForm } from "@/lib/profile-form";

const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
const label = "block text-sm font-medium mb-1";

export default function ProfilePage() {
  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    getBiography()
      .then((b) => {
        const f = profileToForm(b);
        setSaved(f);
        setForm(f);
      })
      .catch(console.error);
  }, []);

  if (!form || !saved) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;

  const dirty = isProfileDirty(saved, form);
  const set = (patch: Partial<ProfileForm>) => {
    setForm({ ...form, ...patch });
    setStatus(null);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const problems = validateProfile(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setStatus({ text: "Please fix the highlighted fields.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await updateBiography(profileToColumns(form));
      setSaved(form);
      setStatus({ text: "Profile saved.", tone: "ok" });
    } catch (err) {
      setStatus({ text: `Could not save: ${String(err)}`, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof ProfileForm) => errors[k] && <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>{errors[k]}</p>;

  return (
    <div className="p-8">
      <PageHeader title="Profile" subtitle="How your biography introduces you" />
      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>Subject identity</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              The formal name of the person this biography is about. Used in memorial headers and genealogy exports.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-first">First name</label>
              <input id="pf-first" value={form.subjectFirstName} onChange={(e) => set({ subjectFirstName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              {err("subjectFirstName")}
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-last">Last name</label>
              <input id="pf-last" value={form.subjectLastName} onChange={(e) => set({ subjectLastName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              {err("subjectLastName")}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-middle">Middle name</label>
              <input id="pf-middle" value={form.subjectMiddleName} onChange={(e) => set({ subjectMiddleName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              {err("subjectMiddleName")}
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-maiden">Maiden name</label>
              <input id="pf-maiden" value={form.subjectMaidenName} onChange={(e) => set({ subjectMaidenName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              {err("subjectMaidenName")}
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-suffix">Suffix</label>
              <input id="pf-suffix" value={form.subjectSuffix} onChange={(e) => set({ subjectSuffix: e.target.value })} placeholder="Jr., III…" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              {err("subjectSuffix")}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>General</h2>
          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-title">Biography title *</label>
            <input id="pf-title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={PROFILE_LIMITS.title + 20} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            {err("title")}
          </div>
          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pf-bio">Bio</label>
            <textarea id="pf-bio" value={form.bio} onChange={(e) => set({ bio: e.target.value })} rows={5} placeholder="A paragraph about you, shown on your home page" className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{form.bio.length}/{PROFILE_LIMITS.bio}</p>
            {err("bio")}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>Banner</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>The banner appears across the top of your home page.</p>
          </div>
          <ImagePicker label="Banner image" allowGallery value={form.bannerPath} onChange={(p) => set({ bannerPath: p })} emptyHint="No banner" />
        </section>

        <div className="flex items-center gap-4 pt-2 border-t sticky bottom-0 py-4" style={{ borderColor: "var(--color-border)", background: "var(--color-background)" }}>
          <button type="submit" disabled={saving || !dirty} className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50" style={{ background: "var(--color-primary)" }}>
            {saving ? "Saving…" : "Save profile"}
          </button>
          {dirty && (
            <button type="button" onClick={() => { setForm(saved); setErrors({}); setStatus(null); }} className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Discard changes
            </button>
          )}
          <span className="text-sm" role="status" style={{ color: status?.tone === "error" ? "var(--color-error)" : "var(--color-success)" }}>
            {status?.text ?? (dirty ? <span style={{ color: "var(--color-text-muted)" }}>Unsaved changes</span> : null)}
          </span>
        </div>
      </form>
    </div>
  );
}
