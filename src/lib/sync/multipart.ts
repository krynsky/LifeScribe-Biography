/**
 * Build a multipart/form-data body by hand. The HTTP plugin sends raw bytes reliably but its
 * FormData support varies by version, so photo uploads assemble the body themselves.
 */
export interface MultipartFile {
  /** Form field name, e.g. "file". */
  field: string;
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export interface Multipart {
  body: Uint8Array;
  contentType: string;
}

const enc = new TextEncoder();

/** Header values can't contain quotes or line breaks. */
function safe(value: string): string {
  return value.replace(/["\r\n\\]/g, "_");
}

export function buildMultipart(fields: Record<string, string | null | undefined>, file: MultipartFile, boundary = `----lifescribe${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`): Multipart {
  const parts: Uint8Array[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(name)}"\r\n\r\n${value}\r\n`));
  }
  parts.push(
    enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(file.field)}"; filename="${safe(file.filename)}"\r\nContent-Type: ${safe(file.mime)}\r\n\r\n`),
    file.bytes,
    enc.encode(`\r\n--${boundary}--\r\n`)
  );
  const total = parts.reduce((n, p) => n + p.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    body.set(p, offset);
    offset += p.length;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
