import { describe, it, expect } from "vitest";
import { assetUrlToPath, rewriteLocalImages } from "./story-images";

const doc = (...srcs: string[]) =>
  JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hi" }] },
      ...srcs.map((src) => ({ type: "image", attrs: { src, alt: null } })),
    ],
  });
const srcs = (json: string) => (JSON.parse(json).content as { type: string; attrs?: { src: string } }[]).filter((n) => n.type === "image").map((n) => n.attrs!.src);

describe("assetUrlToPath", () => {
  it("decodes Windows and other asset URLs", () => {
    expect(assetUrlToPath("http://asset.localhost/C%3A%5CUsers%5Cme%5Cphoto%20one.jpg")).toBe("C:\\Users\\me\\photo one.jpg");
    expect(assetUrlToPath("asset://localhost/%2Fhome%2Fme%2Fa.png")).toBe("/home/me/a.png");
    expect(assetUrlToPath("http://asset.localhost/C%3A%5Ca.jpg?x=1")).toBe("C:\\a.jpg");
  });
  it("returns null for anything else", () => {
    expect(assetUrlToPath("https://files.lifescribe.us/a.jpg")).toBeNull();
    expect(assetUrlToPath("http://asset.localhost/%E0%A4%A")).toBeNull(); // malformed escape
  });
});

describe("rewriteLocalImages", () => {
  it("replaces local photos with uploaded URLs and leaves web photos alone", async () => {
    const content = doc("http://asset.localhost/C%3A%5Ca.jpg", "https://files.lifescribe.us/keep.jpg");
    const uploaded: string[] = [];
    const res = await rewriteLocalImages(content, async (p) => {
      uploaded.push(p);
      return "https://files.lifescribe.us/new.jpg";
    });
    expect(uploaded).toEqual(["C:\\a.jpg"]);
    expect(srcs(res.content)).toEqual(["https://files.lifescribe.us/new.jpg", "https://files.lifescribe.us/keep.jpg"]);
    expect(res).toMatchObject({ found: 1, failed: [] });
  });

  it("uploads each distinct file once", async () => {
    let calls = 0;
    const res = await rewriteLocalImages(doc("http://asset.localhost/a.jpg", "http://asset.localhost/a.jpg", "http://asset.localhost/b.jpg"), async (p) => {
      calls++;
      return `https://x/${p}`;
    });
    expect(calls).toBe(2);
    expect(res.found).toBe(3);
  });

  it("leaves a failed photo in place and reports it, still replacing the others", async () => {
    const res = await rewriteLocalImages(doc("http://asset.localhost/bad.jpg", "http://asset.localhost/ok.jpg"), async (p) => {
      if (p === "bad.jpg") throw new Error("too large");
      return "https://x/ok.jpg";
    });
    expect(srcs(res.content)).toEqual(["http://asset.localhost/bad.jpg", "https://x/ok.jpg"]);
    expect(res.failed).toEqual([{ path: "bad.jpg", error: "too large" }]);
  });

  it("returns the original text when there is nothing to do or it is not JSON", async () => {
    const plain = doc("https://files.lifescribe.us/a.jpg");
    expect((await rewriteLocalImages(plain, async () => "x")).content).toBe(plain);
    expect((await rewriteLocalImages("not json", async () => "x")).found).toBe(0);
  });
});
