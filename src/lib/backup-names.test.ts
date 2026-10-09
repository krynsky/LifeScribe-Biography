import { describe, it, expect } from "vitest";
import { backupFileName, backupsToDelete, isBackupFile, sqlStringLiteral } from "./backup-names";

describe("backupFileName", () => {
  it("is sortable, filesystem-safe and says why", () => {
    const name = backupFileName(new Date("2026-10-08T14:03:22Z"), "Before publish!");
    expect(name).toBe("lifescribe-2026-10-08T14-03-22-before-publish.db");
    expect(isBackupFile(name)).toBe(true);
    expect(name).not.toMatch(/[:\\/]/);
  });
  it("falls back when the reason has no usable characters", () => {
    expect(backupFileName(new Date("2026-01-01T00:00:00Z"), "???")).toMatch(/-backup\.db$/);
  });
});

describe("backupsToDelete", () => {
  const mk = (day: number) => backupFileName(new Date(Date.UTC(2026, 0, day, 10)), "x");
  it("keeps the newest N and only touches our own files", () => {
    const names = [mk(5), mk(1), mk(3), mk(2), mk(4), "notes.txt", "lifescribe.db"];
    expect(backupsToDelete(names, 3)).toEqual([mk(1), mk(2)]);
    expect(backupsToDelete(names, 10)).toEqual([]);
    expect(backupsToDelete([], 3)).toEqual([]);
  });
});

describe("sqlStringLiteral", () => {
  it("escapes single quotes", () => {
    expect(sqlStringLiteral("C:\\Users\\O'Brien\\a.db")).toBe("'C:\\Users\\O''Brien\\a.db'");
  });
});
