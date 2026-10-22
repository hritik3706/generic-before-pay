const MIN_EDGE = 1400;
const MAX_EDGE = 2200;

/** Resize a photo into a range Tesseract can read. Leaves the pixels otherwise unchanged. */
export async function fitForOcr(blob: Blob): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return blob;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return blob;
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest >= MIN_EDGE && longest <= MAX_EDGE) {
    bitmap.close();
    return blob;
  }
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : Math.min(2, MIN_EDGE / longest);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return blob;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
  return out ?? blob;
}
