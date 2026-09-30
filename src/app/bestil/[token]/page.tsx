import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { t, type Lang } from "../i18n";
import { IntakeForm } from "./intake-form";

export const metadata = { title: "Bestil hjælp · Bagscenen", robots: { index: false, follow: false } };

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang: Lang = (await searchParams).lang === "en" ? "en" : "da";
  const tx = t[lang];

  const valid =
    /^[A-Za-z0-9_-]{20,100}$/.test(token) &&
    !!(await db.eventRequest.findFirst({
      where: { tokenHash: hashToken(token), status: "OPEN", expiresAt: { gt: new Date() } },
      select: { id: true },
    }));

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <span className="font-semibold tracking-tight">Bagscenen</span>
        <span className="flex-1" />
        <nav className="flex gap-2 text-xs" aria-label="Sprog / language">
          <Link href="?lang=da" className={lang === "da" ? "font-medium" : "text-muted hover:text-fg"} hrefLang="da">
            Dansk
          </Link>
          <Link href="?lang=en" className={lang === "en" ? "font-medium" : "text-muted hover:text-fg"} hrefLang="en">
            English
          </Link>
        </nav>
        <ThemeToggle />
      </div>
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-16" lang={lang}>
        {valid ? (
          <>
            <h1 className="mb-2 text-xl font-semibold tracking-tight">{tx.title}</h1>
            <p className="mb-8 text-muted">{tx.intro}</p>
            <IntakeForm token={token} lang={lang} />
          </>
        ) : (
          <p className="text-muted">{tx.invalid}</p>
        )}
      </main>
    </div>
  );
}
