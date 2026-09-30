import { z } from "zod";
import { ORG } from "@/lib/org";

const DEFAULT_DOMAINS: string[] = [...ORG.emailDomains];

export function allowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!raw) return DEFAULT_DOMAINS;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Exact domain match — "x@evil-uni.example" or "x@uni.example.evil.com" are rejected. */
export function isAllowedEmail(email: string, domains = allowedEmailDomains()): boolean {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1) return false;
  return domains.includes(normalized.slice(at + 1));
}

/** Strips spaces, dashes and parentheses. Keeps a leading "+". */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-()]/g, "");
}

const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((p) => /^\+?\d{8,15}$/.test(p), "Ugyldigt telefonnummer");

const nameSchema = z.string().trim().min(1, "Skal udfyldes").max(80);

// Frequently used passwords (and Danish/organisation variants) that pass the length rule.
const COMMON_PASSWORDS = new Set([
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "qwertyuiopå", "asdfghjkl", "password1", "password12",
  "password123", "passw0rd123", "adgangskode", "adgangskode1", "adgangskode123", "kodeord123", "sommer2024",
  "sommer2025", "sommer2026", "vinter2025", "vinter2026", "efterår2025", "forår2026", "universitet", "universitet1", "studerende", "medhjælper",
  "medhjaelper", "bagscenen", "bagscenen1", "bagscenen123", "iloveyou12", "letmein123", "welcome123", "velkommen1",
  "velkommen123", "abcdefghij", "abc1234567", "1q2w3e4r5t", "qazwsxedcr", "aaaaaaaaaa", "1111111111", "0000000000",
  ...ORG.weakPasswords,
]);

export const passwordSchema = z
  .string()
  .min(10, "Adgangskoden skal være mindst 10 tegn")
  .max(200, "Adgangskoden er for lang")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "Adgangskoden er for almindelig — vælg en anden")
  .refine((p) => new Set(p).size >= 4, "Adgangskoden er for ensformig");

/** Rejects passwords that contain the user's own name or email. */
export function passwordContainsPersonalInfo(password: string, parts: (string | undefined)[]): boolean {
  const p = password.toLowerCase();
  return parts
    .map((x) => x?.toLowerCase().split("@")[0].trim())
    .some((x) => !!x && x.length >= 3 && p.includes(x));
}

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .transform(normalizeEmail)
  .pipe(z.email("Ugyldig e-mail"))
  .refine((e) => isAllowedEmail(e), `Brug din ${ORG.emailLabel} (${allowedEmailDomains().map((d) => `@${d}`).join(", ")})`);

export const signupSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    privacyAccepted: z.literal("on", { error: "Du skal bekræfte, at du har læst privatlivsinformationen" }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Adgangskoderne er ikke ens",
  })
  .refine((d) => !passwordContainsPersonalInfo(d.password, [d.email, d.firstName, d.lastName]), {
    path: ["password"],
    message: "Adgangskoden må ikke indeholde dit navn eller din mail",
  });

export const loginSchema = z.object({
  email: z.string().trim().max(254).transform(normalizeEmail),
  password: z.string().min(1).max(200),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Adgangskoderne er ikke ens",
  });
