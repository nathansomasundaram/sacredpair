import { describe, expect, it } from "vitest";
import {
  isGuestOnlyPath,
  isProtectedPath,
  safeNext,
} from "@/lib/auth/redirect";
import {
  ageOn,
  logInSchema,
  normalizePhone,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/auth/schemas";

const today = new Date();
function yearsAgo(n: number, dayOffset = 0) {
  const d = new Date(
    Date.UTC(
      today.getUTCFullYear() - n,
      today.getUTCMonth(),
      today.getUTCDate() + dayOffset,
    ),
  );
  return d.toISOString().slice(0, 10);
}

const valid = {
  email: "  Person@Example.com ",
  password: "Covenant2026",
  phone: "(555) 123-4567",
  birthdate: yearsAgo(30),
  acceptTerms: "on",
  marketingEmails: "",
};

function errorsOf(input: unknown) {
  const r = signUpSchema.safeParse(input);
  return r.success
    ? {}
    : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
}

describe("sign-up rules", () => {
  it("accepts a complete sign-up and tidies the values", () => {
    const r = signUpSchema.parse(valid);
    expect(r).toMatchObject({
      email: "person@example.com",
      phone: "+15551234567",
      acceptTerms: true,
      marketingEmails: false,
    });
  });

  it("requires agreeing to the terms", () => {
    expect(errorsOf({ ...valid, acceptTerms: "" })).toMatchObject({
      acceptTerms: "termsRequired",
    });
  });

  it("requires a strong password", () => {
    for (const password of [
      "short1A",
      "alllowercase123",
      "ALLUPPERCASE123",
      "NoDigitsHere!",
    ]) {
      expect(errorsOf({ ...valid, password })).toMatchObject({
        password: "passwordWeak",
      });
    }
  });

  it("turns away anyone under 18, by the day", () => {
    expect(errorsOf({ ...valid, birthdate: yearsAgo(18) })).toEqual({});
    expect(errorsOf({ ...valid, birthdate: yearsAgo(18, 1) })).toMatchObject({
      birthdate: "underage",
    });
  });

  it("rejects impossible dates", () => {
    expect(errorsOf({ ...valid, birthdate: "2001-02-30" })).toMatchObject({
      birthdate: "birthdateInvalid",
    });
    expect(errorsOf({ ...valid, birthdate: "" })).toMatchObject({
      birthdate: "birthdateInvalid",
    });
  });

  it("reports each problem field once", () => {
    const errors = errorsOf({
      email: "nope",
      password: "",
      phone: "1",
      birthdate: "",
      acceptTerms: "",
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["acceptTerms", "birthdate", "email", "password", "phone"].sort(),
    );
  });
});

describe("phone numbers", () => {
  it("reads 10 digits as a US number", () => {
    expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    expect(normalizePhone("1 (555) 123-4567")).toBe("+15551234567");
  });
  it("keeps international numbers that include a country code", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
  });
  it("rejects numbers that are too short or ambiguous", () => {
    expect(normalizePhone("123-4567")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("age", () => {
  it("counts whole years", () => {
    expect(ageOn("2000-06-15", new Date(Date.UTC(2026, 5, 14)))).toBe(25);
    expect(ageOn("2000-06-15", new Date(Date.UTC(2026, 5, 15)))).toBe(26);
  });
});

describe("log in and reset", () => {
  it("needs a password to log in", () => {
    expect(
      logInSchema.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
  });
  it("needs both new passwords to match", () => {
    const r = resetPasswordSchema.safeParse({
      password: "Covenant2026",
      confirmPassword: "Covenant2027",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "passwordMismatch",
    });
  });
});

describe("where people go after logging in", () => {
  it("allows paths on this site", () => {
    expect(safeNext("/chat?with=1")).toBe("/chat?with=1");
  });
  it("refuses other websites, however they are written", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
    ]) {
      expect(safeNext(bad)).toBe("/discover");
    }
  });
  it("knows which pages need a session", () => {
    expect(isProtectedPath("/discover")).toBe(true);
    expect(isProtectedPath("/chat/abc")).toBe(true);
    expect(isProtectedPath("/discoverable")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isGuestOnlyPath("/signup/check-email")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
  });
});
