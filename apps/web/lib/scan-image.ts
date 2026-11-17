/** Longest side sent for invoice reading: enough for small print, well under the 4.5 MB API cap. */
export const SCAN_MAX_SIDE = 2000;
const SCAN_QUALITY = 0.85;

export function scaledSize(width: number, height: number, maxSide = SCAN_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unsupported image")); };
    image.src = url;
  });
}

/**
 * Re-encodes a camera photo as a JPEG data URL, scaled down so that uploads
 * stay small on mobile data. Re-encoding also drops EXIF data such as location.
 */
export async function prepareInvoiceImage(file: File): Promise<string> {
  const image = await loadImage(file);
  const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  // Paint white first so transparent PNGs do not turn black as JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", SCAN_QUALITY);
}
