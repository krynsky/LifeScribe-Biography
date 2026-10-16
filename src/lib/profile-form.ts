import type { Biography } from "./models";

/** Limits copied from the web's site settings so a profile saved here is always accepted there. */
export const PROFILE_LIMITS = { title: 100, bio: 5000, name: 100 } as const;

export interface ProfileForm {
  title: string;
  bio: string;
  subjectFirstName: string;
  subjectMiddleName: string;
  subjectLastName: string;
  subjectMaidenName: string;
  subjectSuffix: string;
  bannerPath: string | null;
}

export function profileToForm(b: Biography): ProfileForm {
  return {
    title: b.title ?? "",
    bio: b.bio ?? "",
    subjectFirstName: b.subject_first_name ?? "",
    subjectMiddleName: b.subject_middle_name ?? "",
    subjectLastName: b.subject_last_name ?? "",
    subjectMaidenName: b.subject_maiden_name ?? "",
    subjectSuffix: b.subject_suffix ?? "",
    bannerPath: b.cover_photo_path,
  };
}

/** Field-by-field problems; an empty object means the form can be saved. */
export function validateProfile(f: ProfileForm): Partial<Record<keyof ProfileForm, string>> {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  if (!f.title.trim()) errors.title = "A title is required.";
  else if (f.title.trim().length > PROFILE_LIMITS.title) errors.title = `Title must be ${PROFILE_LIMITS.title} characters or fewer.`;
  if (f.bio.trim().length > PROFILE_LIMITS.bio) errors.bio = `Bio must be ${PROFILE_LIMITS.bio} characters or fewer.`;
  for (const key of ["subjectFirstName", "subjectMiddleName", "subjectLastName", "subjectMaidenName", "subjectSuffix"] as const) {
    if (f[key].trim().length > PROFILE_LIMITS.name) errors[key] = `Must be ${PROFILE_LIMITS.name} characters or fewer.`;
  }
  return errors;
}

/** Database columns for a (valid) form: blanks become null, text is trimmed. */
export function profileToColumns(f: ProfileForm) {
  const nullIfBlank = (s: string) => s.trim() || null;
  return {
    title: f.title.trim(),
    bio: nullIfBlank(f.bio),
    subject_first_name: nullIfBlank(f.subjectFirstName),
    subject_middle_name: nullIfBlank(f.subjectMiddleName),
    subject_last_name: nullIfBlank(f.subjectLastName),
    subject_maiden_name: nullIfBlank(f.subjectMaidenName),
    subject_suffix: nullIfBlank(f.subjectSuffix),
    cover_photo_path: f.bannerPath,
  };
}

/** True when saving would change something (so the page can show "unsaved changes"). */
export function isProfileDirty(saved: ProfileForm, current: ProfileForm): boolean {
  return JSON.stringify(profileToColumns(saved)) !== JSON.stringify(profileToColumns(current));
}

/** The profile's name as written on a story ("First Middle Last, Suffix"); empty when no name is set. */
export function subjectDisplayName(b: Pick<Biography, "subject_first_name" | "subject_middle_name" | "subject_last_name" | "subject_suffix"> | null | undefined): string {
  if (!b) return "";
  const name = [b.subject_first_name, b.subject_middle_name, b.subject_last_name].map((p) => p?.trim()).filter(Boolean).join(" ");
  const suffix = b.subject_suffix?.trim();
  return suffix && name ? `${name}, ${suffix}` : name;
}
