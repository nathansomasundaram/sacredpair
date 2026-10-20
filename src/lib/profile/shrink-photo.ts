import { PHOTO_MIN_SIDE, PHOTO_UPLOAD_MAX_BYTES } from "./options";

const MAX_SIDE = 2000;

/**
 * Browser only. Shrinks a large photo before upload: faster on phones and
 * keeps uploads small. The server checks and re-encodes it again anyway.
 * Returns "tooSmall" when the photo is under the minimum size.
 */
export async function shrinkPhoto(file: File): Promise<Blob | "tooSmall"> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // The server decides whether it can read this file.
  }
  const { width, height } = bitmap;
  if (Math.min(width, height) < PHOTO_MIN_SIDE) return "tooSmall";
  if (
    Math.max(width, height) <= MAX_SIDE &&
    file.size <= PHOTO_UPLOAD_MAX_BYTES
  ) {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9),
  );
}
