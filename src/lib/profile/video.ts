import "server-only";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "./premium-options";

export type VideoError = "videoNotSupported" | "videoTooLong" | "videoTooLarge";

/**
 * Checks an uploaded MP4 or MOV and removes data that could reveal where it
 * was filmed, without re-encoding:
 *
 *  - Phones store location (and device details) in metadata boxes named
 *    "udta" and "meta", and sometimes an XMP "uuid" box. Each of these is
 *    turned into a "free" box of the same size with its contents zeroed.
 *    Players skip "free" boxes, and keeping the size the same means none of
 *    the video's internal offsets move, so it still plays exactly as before.
 *  - The length is read from the movie header ("mvhd") so videos over the
 *    limit are refused even if the browser check was skipped.
 *
 * Returns a cleaned copy; the input buffer is not changed.
 */
export function cleanVideo(input: Buffer):
  | {
      ok: true;
      data: Buffer;
      seconds: number;
      mimeType: "video/mp4" | "video/quicktime";
    }
  | { ok: false; error: VideoError } {
  if (input.byteLength > VIDEO_MAX_BYTES)
    return { ok: false, error: "videoTooLarge" };

  const data = Buffer.from(input);
  const top = readBoxes(data, 0, data.byteLength);
  if (!top || top.length === 0 || top[0].type !== "ftyp") {
    return { ok: false, error: "videoNotSupported" };
  }
  const brand = data.toString("latin1", top[0].start + 8, top[0].start + 12);
  const mimeType = brand === "qt  " ? "video/quicktime" : "video/mp4";

  const moov = top.find((b) => b.type === "moov");
  if (!moov || !top.some((b) => b.type === "mdat")) {
    return { ok: false, error: "videoNotSupported" };
  }

  const seconds = movieSeconds(data, moov);
  if (seconds === null) return { ok: false, error: "videoNotSupported" };
  if (seconds > VIDEO_MAX_SECONDS + 0.5)
    return { ok: false, error: "videoTooLong" };

  for (const box of top) {
    if (box.type === "meta" || box.type === "udta" || box.type === "uuid")
      blank(data, box);
  }
  if (!scrub(data, moov)) return { ok: false, error: "videoNotSupported" };

  return { ok: true, data, seconds, mimeType };
}

type Box = { type: string; start: number; headerSize: number; end: number };

// Boxes that contain other boxes and can hold metadata further down.
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "edts"]);

function readBoxes(buf: Buffer, from: number, to: number): Box[] | null {
  const boxes: Box[] = [];
  let pos = from;
  while (pos + 8 <= to) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > to) return null;
      const big = buf.readBigUInt64BE(pos + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = to - pos; // runs to the end
    }
    if (size < headerSize || pos + size > to) return null;
    boxes.push({ type, start: pos, headerSize, end: pos + size });
    pos += size;
  }
  return boxes;
}

function scrub(buf: Buffer, parent: Box): boolean {
  const children = readBoxes(buf, parent.start + parent.headerSize, parent.end);
  if (!children) return false;
  for (const child of children) {
    if (child.type === "udta" || child.type === "meta") blank(buf, child);
    else if (CONTAINERS.has(child.type) && !scrub(buf, child)) return false;
  }
  return true;
}

/** Turns a box into a "free" box of the same size with nothing in it. */
function blank(buf: Buffer, box: Box) {
  buf.write("free", box.start + 4, "latin1");
  buf.fill(0, box.start + box.headerSize, box.end);
}

function movieSeconds(buf: Buffer, moov: Box): number | null {
  const mvhd = readBoxes(buf, moov.start + moov.headerSize, moov.end)?.find(
    (b) => b.type === "mvhd",
  );
  if (!mvhd) return null;
  const p = mvhd.start + mvhd.headerSize;
  const version = buf.readUInt8(p);
  const timescale =
    version === 1 ? buf.readUInt32BE(p + 20) : buf.readUInt32BE(p + 12);
  const duration =
    version === 1
      ? Number(buf.readBigUInt64BE(p + 24))
      : buf.readUInt32BE(p + 16);
  return timescale > 0 ? duration / timescale : null;
}
