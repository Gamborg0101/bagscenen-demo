import Link from "next/link";
import { currentUser } from "@/lib/session";
import { ORG } from "@/lib/org";

export const metadata = { title: "Kom godt i gang · Bagscenen" };

// Short guide for student helpers. Public, so it can be linked from the group chat.
export default async function GuidePage() {
  const user = await currentUser();
  const loggedIn = !!user && !user.anonymizedAt && user.status !== "DISABLED";

  return (
    <article className="space-y-6 leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Kom godt i gang</h1>
        <p className="text-muted">Bagscenen er stedet, hvor du ser, hvilke arrangementer du er på, og hvad de kræver.</p>
      </header>

      <Step n={1} title="Opret en konto">
        <p>
          Brug din {ORG.emailLabel} (fx {ORG.emailExample}) og en adgangskode på mindst 10 tegn.
          {!loggedIn && (
            <>
              {" "}
              <Link href="/opret" className="underline underline-offset-2">
                Opret konto
              </Link>
            </>
          )}
        </p>
      </Step>

      <Step n={2} title="Vent på godkendelse">
        <p>{capitalize(ORG.coordinator)} godkender din konto. Derefter kan du logge ind og se dine invitationer.</p>
      </Step>

      <Step n={3} title="Svar på invitationer">
        <p>Nye invitationer til arrangementer, som mangler studentermedhjælpere, står øverst på forsiden.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tryk <b>Ja, jeg kan</b> og vælg dine vagter. Tag gerne hele vagter — det gør det nemmere for alle.</li>
          <li>Når du har sagt ja, kan du ikke selv ændre det. Kan du ikke alligevel, så kontakt {ORG.coordinator}.</li>
        </ul>
      </Step>

      <Step n={4} title="Før og på dagen">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Hvem er på:</b> se hvem der ellers er på arbejde og deres telefonnumre.</li>
          <li><b>Aftaler &amp; noter:</b> skriv det ned, når I aftaler noget med arrangøren.</li>
          <li><b>Kanalplaner:</b> se og redigér kanalplanen for bands; del den med QR-kode.</li>
        </ul>
      </Step>

      <Step n={5} title="Læg Bagscenen på telefonen">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>iPhone:</b> åbn siden i Safari → Del-knappen → <i>Føj til hjemmeskærm</i>.</li>
          <li><b>Android:</b> åbn siden i Chrome → ⋮ → <i>Installer app</i> eller <i>Føj til startskærm</i>.</li>
        </ul>
      </Step>

      <Step n={6} title="Glemt adgangskode?">
        <p>Kontakt {ORG.coordinator}, som sender dig et link, hvor du kan vælge en ny.</p>
      </Step>

      <Step n={7} title="Dine oplysninger">
        <p>
          Under <b>Profil</b> kan du rette dit telefonnummer, hente alle dine data og slette din konto.{" "}
          <Link href="/privatliv" className="underline underline-offset-2">
            Læs om privatliv
          </Link>
        </p>
      </Step>

      <p>
        <Link href={loggedIn ? "/" : "/login"} className="underline underline-offset-2">
          {loggedIn ? "Til forsiden" : "Til login"}
        </Link>
      </p>
    </article>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">
        <span className="mr-2 text-muted tabular-nums">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
