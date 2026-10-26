import { describe, expect, it } from "vitest";
import {
  appliesToCurrency,
  couponState,
  discountedAmount,
  normalizeCode,
} from "@/lib/coupons/pricing";
import {
  bearerKey,
  hashPartnerKey,
  newPartnerKey,
} from "@/lib/coupons/partner-keys";
import {
  couponInputSchema,
  dayToIso,
  dollarsToCents,
  firstProblem,
  partnerViolation,
} from "@/lib/coupons/validation";

describe("coupon prices", () => {
  const percent = { percentOff: 25, amountOffCents: null, currency: "usd" };
  const amount = { percentOff: null, amountOffCents: 500, currency: "usd" };

  it("takes a percentage off, rounding to the nearest cent", () => {
    expect(discountedAmount(1000, "usd", percent)).toBe(750);
    expect(discountedAmount(999, "usd", percent)).toBe(749);
    expect(discountedAmount(1000, "usd", { ...percent, percentOff: 100 })).toBe(
      0,
    );
  });

  it("takes an amount off, never below zero", () => {
    expect(discountedAmount(1000, "usd", amount)).toBe(500);
    expect(discountedAmount(300, "usd", amount)).toBe(0);
  });

  it("leaves a price alone when the amount is in another currency", () => {
    expect(discountedAmount(1000, "eur", amount)).toBe(1000);
    expect(appliesToCurrency("eur", amount)).toBe(false);
    expect(appliesToCurrency("USD", amount)).toBe(true);
    expect(appliesToCurrency("eur", percent)).toBe(true);
  });

  it("reads a typed code the way it's stored", () => {
    expect(normalizeCode("  friends20 ")).toBe("FRIENDS20");
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode(["a"])).toBe("");
    expect(normalizeCode("x".repeat(100))).toHaveLength(40);
  });
});

describe("where a coupon stands", () => {
  const base = {
    active: true,
    startsAt: null,
    expiresAt: null,
    maxRedemptions: null,
    redeemed: 0,
  };
  const now = new Date("2026-06-01T12:00:00Z");

  it("is live, or why it isn't", () => {
    expect(couponState(base, now)).toBe("live");
    expect(couponState({ ...base, active: false }, now)).toBe("off");
    expect(
      couponState({ ...base, expiresAt: "2026-05-31T00:00:00Z" }, now),
    ).toBe("expired");
    expect(
      couponState({ ...base, startsAt: "2026-06-02T00:00:00Z" }, now),
    ).toBe("scheduled");
    expect(couponState({ ...base, maxRedemptions: 3, redeemed: 3 }, now)).toBe(
      "used_up",
    );
    expect(couponState({ ...base, maxRedemptions: 3, redeemed: 2 }, now)).toBe(
      "live",
    );
  });
});

describe("making a coupon", () => {
  const ok = { code: "friends20", percent_off: 20 };

  it("fills in the usual choices and stores the code in upper case", () => {
    const c = couponInputSchema.parse(ok);
    expect(c).toMatchObject({
      code: "FRIENDS20",
      percent_off: 20,
      amount_off_cents: null,
      duration: "once",
      plans: ["monthly", "yearly"],
      currency: "usd",
      max_redemptions: null,
    });
  });

  it("needs a percentage or an amount, not both and not neither", () => {
    for (const bad of [
      { code: "FRIENDS20" },
      { ...ok, amount_off_cents: 500 },
    ]) {
      const r = couponInputSchema.safeParse(bad);
      expect(r.success).toBe(false);
      if (!r.success) expect(firstProblem(r.error)).toBe("percent_or_amount");
    }
    expect(
      couponInputSchema.safeParse({ code: "FIVEOFF", amount_off_cents: 500 })
        .success,
    ).toBe(true);
  });

  it("names the months only for a discount that repeats", () => {
    const repeating = couponInputSchema.safeParse({
      ...ok,
      duration: "repeating",
    });
    expect(repeating.success).toBe(false);
    if (!repeating.success) {
      expect(firstProblem(repeating.error)).toBe("months_when_repeating");
    }
    expect(
      couponInputSchema.safeParse({
        ...ok,
        duration: "repeating",
        duration_months: 3,
      }).success,
    ).toBe(true);
    expect(
      couponInputSchema.safeParse({ ...ok, duration_months: 3 }).success,
    ).toBe(false);
  });

  it("turns away codes and numbers that don't make sense", () => {
    for (const bad of [
      { ...ok, code: "AB" },
      { ...ok, code: "has space" },
      { ...ok, code: "bad!code" },
      { ...ok, percent_off: 0 },
      { ...ok, percent_off: 101 },
      { ...ok, percent_off: 12.5 },
      { ...ok, plans: [] },
      { ...ok, plans: ["weekly"] },
      { ...ok, max_redemptions: 0 },
      { ...ok, expires_at: "tomorrow" },
    ]) {
      expect(couponInputSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("can't end before it starts", () => {
    const r = couponInputSchema.safeParse({
      ...ok,
      starts_at: "2026-06-10T00:00:00Z",
      expires_at: "2026-06-01T00:00:00Z",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstProblem(r.error)).toBe("ends_before_start");
  });

  it("reads dollars and dates typed in the admin form", () => {
    expect(dollarsToCents("5")).toBe(500);
    expect(dollarsToCents("5.50")).toBe(550);
    expect(dollarsToCents("0.1")).toBe(10);
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("5.555")).toBeNull();
    expect(dollarsToCents("five")).toBeNull();
    expect(dayToIso("2026-12-31")).toBe("2026-12-31T00:00:00Z");
    expect(dayToIso("2026-12-31", true)).toBe("2026-12-31T23:59:59Z");
    expect(dayToIso("12/31/2026")).toBeNull();
  });
});

describe("partner limits", () => {
  const partner = { max_percent_off: 30 };
  const coupon = (extra: object) =>
    couponInputSchema.parse({ code: "PARTNER1", percent_off: 20, ...extra });

  it("allows a percentage up to the partner's cap", () => {
    expect(partnerViolation(coupon({}), partner)).toBeNull();
    expect(partnerViolation(coupon({ percent_off: 30 }), partner)).toBeNull();
    expect(partnerViolation(coupon({ percent_off: 31 }), partner)).toBe(
      "percent_too_high",
    );
  });

  it("doesn't allow amounts off", () => {
    expect(
      partnerViolation(
        coupon({ percent_off: null, amount_off_cents: 500 }),
        partner,
      ),
    ).toBe("percent_only");
  });
});

describe("partner keys", () => {
  it("makes long random keys and keeps only their hash", () => {
    const a = newPartnerKey();
    const b = newPartnerKey();
    expect(a.key).toMatch(/^spk_[A-Za-z0-9_-]{40,}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashPartnerKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.key);
  });

  it("reads the key from an Authorization header", () => {
    const { key } = newPartnerKey();
    expect(bearerKey(`Bearer ${key}`)).toBe(key);
    expect(bearerKey(key)).toBeNull();
    expect(bearerKey("Basic abc")).toBeNull();
    expect(bearerKey("Bearer nope")).toBeNull();
    expect(bearerKey(null)).toBeNull();
  });
});
