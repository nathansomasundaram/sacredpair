// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanVideo } from "@/lib/profile/video";

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures", name));

const LOCATION = "+35.7796-078.6382";

/** ffprobe is optional: used when installed to prove the video still plays. */
function ffprobeTags(buf: Buffer): Record<string, string> | null {
  const file = path.join(os.tmpdir(), `clean-${process.pid}-${Date.now()}.mp4`);
  fs.writeFileSync(file, buf);
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-show_entries",
        "format_tags:stream=nb_read_frames",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    );
    const json = JSON.parse(out);
    if (
      !json.streams?.some(
        (s: { nb_read_frames?: string }) => Number(s.nb_read_frames) > 0,
      )
    ) {
      throw new Error("no frames decoded");
    }
    return json.format?.tags ?? {};
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

describe("video cleaning", () => {
  for (const name of ["location.mov", "location.mp4"]) {
    it(`removes the location from ${name} and keeps it playable`, () => {
      const input = fixture(name);
      expect(input.includes(LOCATION)).toBe(true);

      const out = cleanVideo(input);
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.data.byteLength).toBe(input.byteLength);
      expect(out.data.includes(LOCATION)).toBe(false);
      expect(out.data.includes("PhoneMaker")).toBe(false);
      expect(out.seconds).toBeCloseTo(2, 0);
      expect(out.mimeType).toBe(
        name.endsWith(".mov") ? "video/quicktime" : "video/mp4",
      );

      const tags = ffprobeTags(out.data);
      if (tags) {
        expect(tags.location).toBeUndefined();
        expect(tags.make).toBeUndefined();
      }
    });
  }

  it("leaves the original buffer untouched", () => {
    const input = fixture("location.mov");
    cleanVideo(input);
    expect(input.includes(LOCATION)).toBe(true);
  });

  it("refuses videos over 60 seconds", () => {
    expect(cleanVideo(fixture("long.mp4"))).toEqual({
      ok: false,
      error: "videoTooLong",
    });
  });

  it("refuses files that aren't MP4 or MOV", () => {
    expect(cleanVideo(Buffer.from("not a video at all, honestly"))).toEqual({
      ok: false,
      error: "videoNotSupported",
    });
    const webmHeader = Buffer.from([
      0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0x1f, 0x42, 0x86,
    ]);
    expect(cleanVideo(webmHeader)).toEqual({
      ok: false,
      error: "videoNotSupported",
    });
  });

  it("refuses a damaged file", () => {
    const input = fixture("location.mp4");
    expect(
      cleanVideo(input.subarray(0, Math.floor(input.byteLength / 2))).ok,
    ).toBe(false);
  });
});
