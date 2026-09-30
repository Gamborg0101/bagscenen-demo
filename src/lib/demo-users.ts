// The two shared demo accounts. Fixed ids so the nightly reset keeps visitors' sessions valid.
export const DEMO_USERS = {
  coordinator: { id: "cdemokoordinator000000001", role: "ADMIN" },
  helper: { id: "cdemomedhjaelper000000001", role: "HELPER" },
} as const;
