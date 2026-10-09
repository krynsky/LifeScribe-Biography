/**
 * The website accepts images up to 10 MB. Camera photos are often larger, so before uploading, an
 * oversized photo is re-encoded as a smaller JPEG (max 2560 px on the long side), trying
 * progressively smaller sizes until it fits. Photos already under the limit are sent untouched.
 */

export const UPLOAD_MAX_BYTES = 9.5 * 1024 * 1024; // a little under the web's 10 MB cap

export interface ShrinkAttempt {
  maxDim: number;
  quality: number;
}

const ATTEMPTS: ShrinkAttempt[] = [
  { maxDim: 2560, quality: 0.85 },
  { maxDim: 2048, quality: 0.8 },
  { maxDim: 1600, quality: 0.75 },
  { maxDim: 1280, quality: 0.7 },
];

/** The re-encode attempts to try for a file of this size, or none when it already fits. */
export function planShrink(sizeBytes: number, maxBytes: number = UPLOAD_MAX_BYTES): ShrinkAttempt[] {
  return sizeBytes <= maxBytes ? [] : ATTEMPTS;
}

/** Size after fitting inside a `maxDim` box, never enlarging. */
export function scaledSize(width: number, height: number, maxDim: number): { width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PreparedImage {
  bytes: Uint8Array;
  mime: string;
}

/** Return the image ready to upload: unchanged if small enough, otherwise a resized JPEG. Throws if it can't be made small enough. */
export async function prepareForUpload(bytes: Uint8Array, mime: string, maxBytes: number = UPLOAD_MAX_BYTES): Promise<PreparedImage> {
  const attempts = planShrink(bytes.length, maxBytes);
  if (attempts.length === 0) return { bytes, mime };
  if (mime === "image/gif") throw new Error("This animated GIF is larger than 10 MB, which the website does not accept.");

  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
  try {
    for (const { maxDim, quality } of attempts) {
      const { width, height } = scaledSize(bitmap.width, bitmap.height, maxDim);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not resize the image.");
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (blob.size <= maxBytes) return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: "image/jpeg" };
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This image is too large for the website even after resizing.");
}
