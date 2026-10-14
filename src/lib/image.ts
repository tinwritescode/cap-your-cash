export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;

export type Prepared = { original: Blob; thumb: Blob; preview: string };

export function checkFile(f: File): string | null {
  if (!ACCEPTED.includes(f.type)) return `"${f.name}" không được hỗ trợ. Chỉ nhận JPEG, PNG, WebP (ảnh HEIC hãy chuyển sang JPEG).`;
  if (f.size > MAX_BYTES) return `"${f.name}" vượt quá 10 MB.`;
  return null;
}

async function decode(f: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(f);
    } catch {
      /* fallthrough */
    }
  }
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Trình duyệt không đọc được ảnh này. Hãy dùng JPEG, PNG hoặc WebP."));
    img.src = URL.createObjectURL(f);
  });
}

function resize(src: ImageBitmap | HTMLImageElement, maxEdge: number, quality: number): Promise<Blob> {
  const w = src.width, h = src.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không nén được ảnh"))), "image/jpeg", quality));
}

export async function prepareImage(f: File): Promise<Prepared> {
  const img = await decode(f);
  const original = await resize(img, 1600, 0.85);
  const thumb = await resize(img, 360, 0.75);
  return { original, thumb, preview: URL.createObjectURL(thumb) };
}
