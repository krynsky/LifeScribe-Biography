import { describe, it, expect } from "vitest";
import { isProfileDirty, profileToColumns, profileToForm, validateProfile, type ProfileForm } from "./profile-form";
import type { Biography } from "./models";

const form: ProfileForm = {
  title: "My Life Story",
  tagline: "",
  bio: "",
  subjectFirstName: "",
  subjectMiddleName: "",
  subjectLastName: "",
  subjectMaidenName: "",
  subjectSuffix: "",
  avatarPath: null,
  bannerPath: null,
};

describe("validateProfile", () => {
  it("accepts a minimal profile", () => {
    expect(validateProfile(form)).toEqual({});
  });
  it("requires a title and enforces the web's limits", () => {
    expect(validateProfile({ ...form, title: "  " }).title).toMatch(/required/);
    expect(validateProfile({ ...form, title: "x".repeat(101) }).title).toMatch(/100/);
    expect(validateProfile({ ...form, tagline: "x".repeat(201) }).tagline).toMatch(/200/);
    expect(validateProfile({ ...form, bio: "x".repeat(5001) }).bio).toMatch(/5000/);
    expect(validateProfile({ ...form, subjectSuffix: "x".repeat(101) }).subjectSuffix).toMatch(/100/);
    expect(validateProfile({ ...form, title: "x".repeat(100), bio: "x".repeat(5000) })).toEqual({});
  });
});

describe("profileToColumns", () => {
  it("trims text and turns blanks into null", () => {
    const cols = profileToColumns({ ...form, title: "  Mark  ", tagline: "  ", subjectFirstName: " Mark ", avatarPath: "C:/a.jpg" });
    expect(cols).toMatchObject({ title: "Mark", tagline: null, subject_first_name: "Mark", subject_last_name: null, avatar_photo_path: "C:/a.jpg", cover_photo_path: null });
  });
});

describe("profileToForm and isProfileDirty", () => {
  it("round-trips a biography row", () => {
    const row = {
      id: 1, title: "T", tagline: null, bio: "B", birth_date: null, birth_place: null,
      cover_photo_path: "b.jpg", avatar_photo_path: null, created_at: "", updated_at: "",
      subject_first_name: "Mark", subject_middle_name: null, subject_last_name: "K", subject_maiden_name: null, subject_suffix: null,
    } as Biography;
    const f = profileToForm(row);
    expect(f).toMatchObject({ title: "T", tagline: "", bio: "B", subjectFirstName: "Mark", subjectLastName: "K", bannerPath: "b.jpg" });
    expect(isProfileDirty(f, { ...f })).toBe(false);
  });
  it("ignores whitespace-only differences but sees real edits", () => {
    expect(isProfileDirty(form, { ...form, tagline: "   " })).toBe(false);
    expect(isProfileDirty(form, { ...form, tagline: "Hi" })).toBe(true);
    expect(isProfileDirty(form, { ...form, bannerPath: "x.jpg" })).toBe(true);
  });
});
