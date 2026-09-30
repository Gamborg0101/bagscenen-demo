import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/styles";
import { isDemo } from "@/lib/demo";
import { currentUser } from "@/lib/session";
import { demoLoginAction } from "../actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log ind · Bagscenen" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ nulstillet?: string; next?: string; demo?: string }>;
}) {
  const user = await currentUser();
  const { nulstillet, next, demo } = await searchParams;
  if (user && user.status !== "DISABLED" && !user.anonymizedAt) redirect("/");

  if (isDemo()) return <DemoLogin failed={demo === "fejl"} />;

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Log ind</h1>
      <LoginForm reset={nulstillet === "1"} next={next ?? "/"} />
      <p className="mt-6 text-xs text-muted">
        Ny medhjælper?{" "}
        <Link href="/opret" className="text-fg underline underline-offset-2">
          Opret konto
        </Link>{" "}
        ·{" "}
        <Link href="/kom-godt-i-gang" className="text-fg underline underline-offset-2">
          Kom godt i gang
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted">
        Glemt adgangskoden? Kontakt din koordinator, så får du et nyt link.
      </p>
    </>
  );
}

function DemoLogin({ failed }: { failed: boolean }) {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold tracking-tight">Prøv Bagscenen</h1>
      <p className="mb-6 text-muted">
        Et værktøj til at planlægge studentermedhjælpere til arrangementer. Dette er en demo med opdigtede personer og
        arrangementer — alt nulstilles hver nat, så du kan trygt klikke rundt.
      </p>
      {failed && <p className="mb-4 text-xs text-danger">Det lykkedes ikke at logge ind. Vent lidt og prøv igen.</p>}
      <div className="space-y-3">
        <form action={demoLoginAction}>
          <input type="hidden" name="role" value="coordinator" />
          <button className={`${buttonClass("primary")} w-full`}>Prøv som koordinator</button>
          <p className="mt-1 text-xs text-muted">Opret arrangementer, invitér medhjælpere, se hvem der mangler.</p>
        </form>
        <form action={demoLoginAction}>
          <input type="hidden" name="role" value="helper" />
          <button className={`${buttonClass("secondary")} w-full`}>Prøv som medhjælper</button>
          <p className="mt-1 text-xs text-muted">Svar på invitationer, vælg vagter, se hvem du er på med.</p>
        </form>
      </div>
      <p className="mt-6 text-xs text-muted">
        Appen er på dansk.{" "}
        <Link href="/kom-godt-i-gang" className="text-fg underline underline-offset-2">
          Kom godt i gang
        </Link>
      </p>
    </>
  );
}
