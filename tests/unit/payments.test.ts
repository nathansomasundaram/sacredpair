import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  customerId,
  entitlementFromSubscription,
  paidUntil,
} from "@/lib/payments/subscription";

const PERIOD_END = Date.UTC(2026, 11, 1) / 1000;

function sub(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_123",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: "cus_123",
    metadata: { user_id: "u1" },
    items: {
      data: [{ current_period_end: PERIOD_END }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("Stripe subscriptions and Premium", () => {
  it("give Premium until the end of the paid period, renewing", () => {
    expect(entitlementFromSubscription(sub())).toEqual({
      tier: "premium",
      source: "stripe",
      expires_at: "2026-12-01T00:00:00.000Z",
      renews: true,
      external_subscription_id: "sub_123",
    });
  });

  it("keep Premium to the end of the period after cancelling, without renewing", () => {
    const e = entitlementFromSubscription(sub({ cancel_at_period_end: true }));
    expect(e.tier).toBe("premium");
    expect(e.renews).toBe(false);
    expect(e.expires_at).toBe("2026-12-01T00:00:00.000Z");
  });

  it("keep Premium while a failed card is being retried", () => {
    expect(entitlementFromSubscription(sub({ status: "past_due" })).tier).toBe(
      "premium",
    );
    expect(entitlementFromSubscription(sub({ status: "trialing" })).tier).toBe(
      "premium",
    );
  });

  it("end Premium when the subscription stops", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ] as const) {
      expect(entitlementFromSubscription(sub({ status }))).toEqual({
        tier: "free",
        source: null,
        expires_at: null,
        renews: false,
        external_subscription_id: null,
      });
    }
  });

  it("use the latest period end across items", () => {
    const s = sub({
      items: {
        data: [
          { current_period_end: PERIOD_END },
          { current_period_end: PERIOD_END + 86400 },
        ],
      } as unknown as Stripe.Subscription["items"],
    });
    expect(paidUntil(s)?.toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });

  it("read customer IDs whether expanded or not", () => {
    expect(customerId("cus_1")).toBe("cus_1");
    expect(customerId({ id: "cus_2" })).toBe("cus_2");
    expect(customerId(null)).toBeNull();
  });
});
