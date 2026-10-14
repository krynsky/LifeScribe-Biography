import { describe, expect, it } from "vitest";
import { isSameOrInside, looksCloudSynced, rewriteAssetUrls, rewritePath } from "./data-move";

const OLD = "C:\\Users\\me\\AppData\\Local\\com.lifescribe.app";
const NEW = "D:\\My Biography";

describe("isSameOrInside", () => {
  it("ignores slash style and case", () => {
    expect(isSameOrInside("c:/users/me/appdata/local/com.lifescribe.app/images/a.jpg", OLD)).toBe(true);
    expect(isSameOrInside(OLD, OLD + "\\")).toBe(true);
    expect(isSameOrInside(OLD + "-other\\x", OLD)).toBe(false);
  });
});

describe("rewritePath", () => {
  it("moves paths under the old folder to the new one", () => {
    expect(rewritePath(`${OLD}\\images\\ab12.jpg`, OLD, NEW)).toBe("D:\\My Biography\\images\\ab12.jpg");
    expect(rewritePath("c:/users/me/appdata/local/com.lifescribe.app/media/x.jpg", OLD, NEW)).toBe("D:\\My Biography\\media\\x.jpg");
  });
  it("leaves other paths (the user's own photo folders, URLs, blanks) alone", () => {
    expect(rewritePath("E:\\Photos\\trip.jpg", OLD, NEW)).toBe("E:\\Photos\\trip.jpg");
    expect(rewritePath("https://example.com/a.jpg", OLD, NEW)).toBe("https://example.com/a.jpg");
    expect(rewritePath("", OLD, NEW)).toBe("");
    expect(rewritePath(OLD, OLD, NEW)).toBe(OLD);
  });
});

describe("rewriteAssetUrls", () => {
  it("rewrites the encoded folder inside story image URLs", () => {
    const url = `http://asset.localhost/${encodeURIComponent(`${OLD}\\images\\ab12.jpg`)}`;
    const out = rewriteAssetUrls(`{"src":"${url}"}`, OLD, NEW);
    expect(out).toBe(`{"src":"http://asset.localhost/${encodeURIComponent("D:\\My Biography\\images\\ab12.jpg")}"}`);
  });
  it("leaves text without the old folder alone", () => {
    const text = '{"src":"https://files.example.com/a.jpg"}';
    expect(rewriteAssetUrls(text, OLD, NEW)).toBe(text);
  });
});

describe("looksCloudSynced", () => {
  it("flags the usual sync folders", () => {
    expect(looksCloudSynced("C:\\Users\\me\\OneDrive\\Documents")).toBe(true);
    expect(looksCloudSynced("C:\\Users\\me\\Dropbox\\LifeScribe")).toBe(true);
    expect(looksCloudSynced("/Users/me/Google Drive/data")).toBe(true);
    expect(looksCloudSynced("D:\\My Biography")).toBe(false);
  });
});
