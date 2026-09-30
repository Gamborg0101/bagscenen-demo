"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Admin navigation; the current section is highlighted. */
export function NavLinks({ items, className = "" }: { items: NavItem[]; className?: string }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label="Hovedmenu">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={active ? "text-fg" : "text-muted hover:text-fg"}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
