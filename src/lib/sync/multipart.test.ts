import { describe, it, expect } from "vitest";
import { buildMultipart } from "./multipart";

const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("buildMultipart", () => {
  it("writes fields, then the file with its type, and closes the boundary", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x0d, 0x0a, 0x41]);
    const { body, contentType } = buildMultipart({ albumId: "alb1", caption: "Hi" }, { field: "file", filename: "a.jpg", mime: "image/jpeg", bytes }, "BOUND");
    expect(contentType).toBe("multipart/form-data; boundary=BOUND");
    const s = text(body);
    expect(s).toContain('--BOUND\r\nContent-Disposition: form-data; name="albumId"\r\n\r\nalb1\r\n');
    expect(s).toContain('name="caption"\r\n\r\nHi\r\n');
    expect(s).toContain('name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
    expect(s.endsWith("\r\n--BOUND--\r\n")).toBe(true);
  });

  it("keeps the file bytes intact, including bytes that look like line breaks", () => {
    const bytes = new Uint8Array([0, 255, 13, 10, 45, 45, 66, 79, 85, 78, 68, 1]);
    const { body } = buildMultipart({}, { field: "file", filename: "x.png", mime: "image/png", bytes }, "ZZ");
    const start = text(body).indexOf("\r\n\r\n") + 4;
    expect([...body.slice(start, start + bytes.length)]).toEqual([...bytes]);
  });

  it("skips empty fields and sanitises header values", () => {
    const { body } = buildMultipart({ a: null, b: undefined, c: "yes" }, { field: "file", filename: 'we"ird\r\nname.jpg', mime: "image/jpeg", bytes: new Uint8Array() }, "B");
    const s = text(body);
    expect(s).not.toContain('name="a"');
    expect(s).not.toContain('name="b"');
    expect(s).toContain('name="c"');
    expect(s).toContain('filename="we_ird__name.jpg"');
  });
});
