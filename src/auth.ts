import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { isDemo } from "@/lib/demo";
import { resetDemoData } from "@/lib/demo-seed";
import { DEMO_USERS } from "@/lib/demo-users";
import { demoLoginAllowed, loginAllowed } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/user";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        if (!(await loginAllowed(email))) throw new RateLimited();

        const user = await db.user.findUnique({ where: { email } });
        if (!user || user.anonymizedAt) {
          await burnPasswordCheck(password);
          return null;
        }
        if (!(await verifyPassword(user.passwordHash, password))) return null;
        if (user.status === "DISABLED") return null;

        // Only the id and session version go into the JWT; role/status are re-read from the DB on every request.
        return { id: user.id, sv: user.sessionVersion };
      },
    }),
    // Only registered on the public demo (DEMO_MODE=1).
    ...(isDemo()
      ? [
          Credentials({
            id: "demo",
            credentials: { role: {} },
            async authorize(raw) {
              const role = raw?.role;
              if (role !== "coordinator" && role !== "helper") return null;
              if (!(await demoLoginAllowed())) throw new RateLimited();
              const { id, role: userRole } = DEMO_USERS[role];
              if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) await resetDemoData(db);
              // Undo anything a visitor may have changed on the shared account.
              const user = await db.user.update({
                where: { id },
                data: { role: userRole, status: "ACTIVE", disabledAt: null, anonymizedAt: null },
              });
              return { id: user.id, sv: user.sessionVersion };
            },
          }),
        ]
      : []),
  ],
  events: {
    async signIn({ user }) {
      if (user.id) await audit(user.id, "user.login", "User", user.id);
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.sv = user.sv ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sv = token.sv ?? 0;
      return session;
    },
  },
});
