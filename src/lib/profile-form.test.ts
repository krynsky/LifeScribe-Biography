import { describe, it, expect } from "vitest";
import { isProfileDirty, profileToColumns, profileToForm, subjectDisplayName, validateProfile, type ProfileForm } from "./profile-form";
import type { Biography } from "./models";

const form: ProfileForm = {
  title: "My Life Story",
  bio: "",
  subjectFirstName: "",
  subjectMiddleName: "",
  subjectLastName: "",
  subjectMaidenName: "",
  subjectSuffix: "",
  bannerPath: null,
};

describe("validateProfile", () => {
  it("accepts a minimal profile", () => {
    expect(validateProfile(form)).toEqual({});
  });
  it("requires a title and enforces the web's limits", () => {
    expect(validateProfile({ ...form, title: "  " }).title).toMatch(/required/);
    expect(validateProfile({ ...form, title: "x".repeat(101) }).title).toMatch(/100/);
    expect(validateProfile({ ...form, bio: "x".repeat(5001) }).bio).toMatch(/5000/);
    expect(validateProfile({ ...form, subjectSuffix: "x".repeat(101) }).subjectSuffix).toMatch(/100/);
    expect(validateProfile({ ...form, title: "x".repeat(100), bio: "x".repeat(5000) })).toEqual({});
  });
});

describe("profileToColumns", () => {
  it("trims text and turns blanks into null", () => {
    const cols = profileToColumns({ ...form, title: "  Mark  ", bio: "  ", subjectFirstName: " Mark ", bannerPath: "C:/b.jpg" });
    expect(cols).toMatchObject({ title: "Mark", bio: null, subject_first_name: "Mark", subject_last_name: null, cover_photo_path: "C:/b.jpg" });
  });
});

describe("profileToForm and isProfileDirty", () => {
  it("round-trips a biography row", () => {
    const row = {
      id: 1, title: "T", bio: "B", birth_date: null, birth_place: null,
      cover_photo_path: "b.jpg", created_at: "", updated_at: "",
      subject_first_name: "Mark", subject_middle_name: null, subject_last_name: "K", subject_maiden_name: null, subject_suffix: null,
    } as Biography;
    const f = profileToForm(row);
    expect(f).toMatchObject({ title: "T", bio: "B", subjectFirstName: "Mark", subjectLastName: "K", bannerPath: "b.jpg" });
    expect(isProfileDirty(f, { ...f })).toBe(false);
  });
  it("ignores whitespace-only differences but sees real edits", () => {
    expect(isProfileDirty(form, { ...form, bio: "   " })).toBe(false);
    expect(isProfileDirty(form, { ...form, bio: "Hi" })).toBe(true);
    expect(isProfileDirty(form, { ...form, bannerPath: "x.jpg" })).toBe(true);
  });
});

describe("subjectDisplayName", () => {
  const base = { subject_first_name: null, subject_middle_name: null, subject_last_name: null, subject_suffix: null };
  it("joins the name parts and adds a suffix", () => {
    expect(subjectDisplayName({ ...base, subject_first_name: "Mark", subject_middle_name: "J", subject_last_name: "Krynsky", subject_suffix: "Jr." })).toBe("Mark J Krynsky, Jr.");
    expect(subjectDisplayName({ ...base, subject_first_name: " Mark ", subject_last_name: "Krynsky" })).toBe("Mark Krynsky");
  });
  it("is empty when no name is set", () => {
    expect(subjectDisplayName(base)).toBe("");
    expect(subjectDisplayName({ ...base, subject_suffix: "Jr." })).toBe("");
    expect(subjectDisplayName(null)).toBe("");
  });
});
