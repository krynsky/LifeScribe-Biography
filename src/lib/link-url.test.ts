import { describe, it, expect } from "vitest";
import { normalizeLinkUrl } from "./link-url";

describe("normalizeLinkUrl", () => {
  it("keeps valid http(s), mailto and tel links", () => {
    expect(normalizeLinkUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeLinkUrl("mailto:me@example.com")).toBe("mailto:me@example.com");
    expect(normalizeLinkUrl("tel:+15551234")).toBe("tel:+15551234");
  });
  it("completes bare domains and emails", () => {
    expect(normalizeLinkUrl("example.com/page")).toBe("https://example.com/page");
    expect(normalizeLinkUrl("me@example.com")).toBe("mailto:me@example.com");
  });
  it("rejects dangerous or meaningless input", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkUrl("data:text/html,hi")).toBeNull();
    expect(normalizeLinkUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeLinkUrl("just words")).toBeNull();
    expect(normalizeLinkUrl("")).toBeNull();
  });
});
