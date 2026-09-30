import { describe, expect, it } from "vitest";
import { ORG } from "@/lib/org";
import { canManageUser } from "@/lib/permissions";
import { isAllowedEmail, normalizePhone, signupSchema } from "./user";

const DOMAINS = ["post.uni.example", "uni.example", "stud.uni.example"];

describe("isAllowedEmail", () => {
  it.each(["ab123456@post.uni.example", "Test@UNI.EXAMPLE", " x@stud.uni.example "])("accepts %s", (e) => {
    expect(isAllowedEmail(e, DOMAINS)).toBe(true);
  });

  it.each(["x@gmail.com", "x@evil-uni.example", "x@uni.example.evil.com", "x@sub.uni.example", "@uni.example", "uni.example", "x@post.uni.example@evil.com"])(
    "rejects %s",
    (e) => {
      expect(isAllowedEmail(e, DOMAINS)).toBe(false);
    },
  );
});

describe("normalizePhone", () => {
  it("strips spacing and punctuation", () => {
    expect(normalizePhone(" +45 12 34-56 78 ")).toBe("+4512345678");
  });
});

describe("signupSchema", () => {
  const valid = {
    firstName: "Test",
    lastName: "Hansen",
    email: `TEST@${ORG.emailDomains[0]}`,
    phone: "12 34 56 78",
    password: "correct horse",
    passwordConfirm: "correct horse",
    privacyAccepted: "on",
  };

  it("parses and normalises a valid signup", () => {
    const r = signupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe(`test@${ORG.emailDomains[0]}`);
    expect(r.data?.phone).toBe("12345678");
  });

  it("rejects other email domains, short password, mismatch and missing consent", () => {
    expect(signupSchema.safeParse({ ...valid, email: "test@gmail.com" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "short", passwordConfirm: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, passwordConfirm: "different pw" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, privacyAccepted: undefined }).success).toBe(false);
  });

  it("rejects common passwords and passwords containing the user's name or mail", () => {
    const pw = (password: string) => signupSchema.safeParse({ ...valid, password, passwordConfirm: password }).success;
    expect(pw("Adgangskode123")).toBe(false);
    expect(pw("aaaaaaaaaaaa")).toBe(false);
    expect(pw("hansen-er-sej-2026")).toBe(false);
    expect(pw("test-min-kode-99")).toBe(false);
    expect(pw("blå hest på taget")).toBe(true);
  });
});

describe("canManageUser", () => {
  const admin = { id: "a", role: "ADMIN" as const };
  const lead = { id: "l", role: "LEAD" as const };
  const helper = { id: "h", role: "HELPER" as const };

  it("admin manages everyone but themselves", () => {
    expect(canManageUser(admin, lead)).toBe(true);
    expect(canManageUser(admin, helper)).toBe(true);
    expect(canManageUser(admin, admin)).toBe(false);
  });

  it("lead manages only helpers", () => {
    expect(canManageUser(lead, helper)).toBe(true);
    expect(canManageUser(lead, admin)).toBe(false);
    expect(canManageUser(lead, { id: "l2", role: "LEAD" })).toBe(false);
  });

  it("helper manages no one", () => {
    expect(canManageUser(helper, { id: "h2", role: "HELPER" })).toBe(false);
  });
});
