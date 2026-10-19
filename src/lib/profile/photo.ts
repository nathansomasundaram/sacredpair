import "server-only";
import sharp, { type Metadata } from "sharp";
import { PHOTO_MIN_SIDE, PHOTO_UPLOAD_MAX_BYTES } from "./options";

export type PhotoError = "photoNotImage" | "photoTooSmall" | "photoTooLarge";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/**
 * Checks and cleans an uploaded photo before it's stored:
 *  - reads the actual file contents, not the name or declared type
 *  - turns it upright using the camera's orientation, then drops all
 *    metadata (EXIF, including GPS location)
 *  - resizes to at most 1600 px on the long side and saves as WebP
 */
export async function processPhoto(
  input: Buffer,
): Promise<
  | { ok: true; data: Buffer; width: number; height: number }
  | { ok: false; error: PhotoError }
> {
  if (input.byteLength > PHOTO_UPLOAD_MAX_BYTES)
    return { ok: false, error: "photoTooLarge" };

  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    return { ok: false, error: "photoNotImage" };
  }
  if (
    !meta.format ||
    !ACCEPTED_FORMATS.has(meta.format) ||
    (meta.pages ?? 1) > 1
  ) {
    return { ok: false, error: "photoNotImage" };
  }

  // Width and height as the photo is meant to be seen (after rotation).
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = (sideways ? meta.height : meta.width) ?? 0;
  const height = (sideways ? meta.width : meta.height) ?? 0;
  if (Math.min(width, height) < PHOTO_MIN_SIDE)
    return { ok: false, error: "photoTooSmall" };

  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return { ok: true, data, width: info.width, height: info.height };
}
