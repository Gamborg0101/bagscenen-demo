import type { NextConfig } from "next";

// The Content-Security-Policy is set per request in src/middleware.ts (it needs a nonce).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The end-to-end smoke test builds into its own folder so it never collides with `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // The largest legitimate payload is an event form; keep requests small.
    serverActions: { bodySizeLimit: "256kb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
