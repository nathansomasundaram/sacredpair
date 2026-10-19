// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processPhoto } from "@/lib/profile/photo";
import { profileOverviewSchema } from "@/lib/profile/schemas";

function jpeg(
  width: number,
  height: number,
  withGps = false,
  orientation?: number,
) {
  let img = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 90, b: 200 },
    },
  }).jpeg();
  if (withGps || orientation) {
    img = img.withMetadata({
      ...(orientation ? { orientation } : {}),
      ...(withGps
        ? {
            exif: {
              IFD0: { Make: "PhoneMaker", Model: "Phone 15" },
              IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 46/1 0/1" },
            },
          }
        : {}),
    });
  }
  return img.toBuffer();
}

describe("photo processing", () => {
  it("removes location and camera details", async () => {
    const input = await jpeg(900, 1200, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processPhoto(input);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it("turns sideways phone photos upright", async () => {
    // Stored 1200x900 but the camera says "rotate 90°": meant to be portrait.
    const out = await processPhoto(await jpeg(1200, 900, false, 6));
    expect(out.ok && [out.width, out.height]).toEqual([900, 1200]);
  });

  it("shrinks big photos to 1600 px on the long side", async () => {
    const out = await processPhoto(await jpeg(2400, 3000));
    expect(out.ok && Math.max(out.width, out.height)).toBe(1600);
  });

  it("turns away photos that are too small", async () => {
    expect(await processPhoto(await jpeg(300, 800))).toEqual({
      ok: false,
      error: "photoTooSmall",
    });
  });

  it("judges the file by its contents, not its name or type", async () => {
    const fake = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    expect(await processPhoto(fake)).toEqual({
      ok: false,
      error: "photoNotImage",
    });
    expect(await processPhoto(Buffer.from("not an image at all"))).toEqual({
      ok: false,
      error: "photoNotImage",
    });
  });

  it("accepts PNG and WebP too", async () => {
    const base = sharp({
      create: { width: 600, height: 600, channels: 3, background: "#ccc" },
    });
    expect((await processPhoto(await base.clone().png().toBuffer())).ok).toBe(
      true,
    );
    expect((await processPhoto(await base.clone().webp().toBuffer())).ok).toBe(
      true,
    );
  });
});

describe("profile overview rules", () => {
  const valid = {
    displayName: "  Mary   Ann ",
    city: " Raleigh ",
    stateCode: "NC",
    aboutMe: "  Line one\r\nLine two  ",
    traits: ["kind", "kind", "funny"],
  };

  it("tidies what people type", () => {
    expect(profileOverviewSchema.parse(valid)).toEqual({
      displayName: "Mary Ann",
      city: "Raleigh",
      stateCode: "NC",
      aboutMe: "Line one\nLine two",
      traits: ["kind", "funny"],
    });
  });

  it("needs a name, a city and a real state", () => {
    const r = profileOverviewSchema.safeParse({
      ...valid,
      displayName: "   ",
      city: "",
      stateCode: "XX",
    });
    const errors = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [i.path[0], i.message]),
    );
    expect(errors).toEqual({
      displayName: "nameRequired",
      city: "cityRequired",
      stateCode: "stateRequired",
    });
  });

  it("allows at most five traits, all from the list", () => {
    const six = ["kind", "honest", "loyal", "patient", "funny", "calm"];
    expect(
      profileOverviewSchema.safeParse({ ...valid, traits: six }).success,
    ).toBe(false);
    expect(
      profileOverviewSchema.safeParse({ ...valid, traits: ["mysterious"] })
        .success,
    ).toBe(false);
  });
});
