// Everything that ties the app to one organisation. This is the neutral version used by the
// public demo; set your own values here (and ALLOWED_EMAIL_DOMAINS) to run it for real.

export const ORG = {
  /** Data controller named on the privacy page. */
  name: "Demo Universitet",
  /** Used in short descriptions, e.g. "studentermedhjælpere på universitetet". */
  short: "universitetet",
  /** Where helpers find the data protection officer, shown on the privacy page. */
  dpoHint: "kontaktoplysninger findes på universitetets hjemmeside",
  /** Signup is limited to these domains unless ALLOWED_EMAIL_DOMAINS is set. */
  emailDomains: ["uni.example"],
  emailLabel: "uni-mail",
  emailExample: "ab123456@uni.example",
  /** Who approves accounts and handles changes, as named in the helper guide. */
  coordinator: "koordinatoren",
  /** Organisation-specific words that make weak passwords (added to the common-password list). */
  weakPasswords: [],
} as const;
