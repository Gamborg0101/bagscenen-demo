import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/demo";
import { ORG } from "@/lib/org";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Opret konto · Bagscenen" };

export default function SignupPage() {
  if (isDemo()) redirect("/login");
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Opret konto</h1>
      <p className="mb-6 text-xs text-muted">
        Brug din {ORG.emailLabel}. Din konto skal godkendes af en koordinator, før du kan se arrangementer.
      </p>
      <SignupForm />
      <p className="mt-6 text-xs text-muted">
        Har du allerede en konto?{" "}
        <Link href="/login" className="text-fg underline underline-offset-2">
          Log ind
        </Link>
      </p>
    </>
  );
}
