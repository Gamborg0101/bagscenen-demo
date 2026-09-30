import Link from "next/link";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { isDemo } from "@/lib/demo";
import { hasRole, requireUser } from "@/lib/session";
import { logoutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const items: NavItem[] = hasRole(user.role, "LEAD")
    ? [
        { href: "/admin/arrangementer", label: "Arrangementer" },
        { href: "/admin/bestillinger", label: "Bestillinger" },
        { href: "/admin/brugere", label: "Brugere" },
        ...(user.role === "ADMIN" ? [{ href: "/admin/log", label: "Log" }] : []),
      ]
    : [];

  return (
    <div className="min-h-dvh">
      {isDemo() && (
        <div className="border-b border-line bg-subtle text-xs text-muted print:hidden">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 px-4 py-1.5">
            <span>
              Demo · du er {hasRole(user.role, "LEAD") ? "koordinator" : "medhjælper"} · opdigtede data, nulstilles hver nat
            </span>
            <form action={logoutAction} className="ml-auto">
              <button className="underline underline-offset-2 hover:text-fg">Skift rolle</button>
            </form>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-4 px-4">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Bagscenen
          </Link>
          {/* Wide screens: menu inline. */}
          <NavLinks items={items} className="hidden flex-1 items-center gap-4 whitespace-nowrap sm:flex" />
          <span className="flex-1 sm:hidden" />
          <ThemeToggle />
          <Link href="/profil" className="shrink-0 text-muted hover:text-fg">
            Profil
          </Link>
          <form action={logoutAction}>
            <button className="shrink-0 whitespace-nowrap text-muted hover:text-fg">Log ud</button>
          </form>
        </div>
        {/* Phones: the menu gets its own row so every item is visible. */}
        {items.length > 0 && (
          <NavLinks items={items} className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-1 px-4 pb-2.5 sm:hidden" />
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
