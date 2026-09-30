import Link from "next/link";
import { ORG } from "@/lib/org";
import { RETENTION } from "@/lib/retention";

export const metadata = { title: "Privatliv · Bagscenen" };

// Information per GDPR art. 13. Keep in sync with docs/gdpr/.
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  const r = RETENTION;

  return (
    <article className="space-y-6 leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Privatlivsinformation</h1>
        <p className="text-muted">Sådan behandler Bagscenen personoplysninger.</p>
      </header>

      <Section title="Dataansvarlig">
        <p>
          {ORG.name} er dataansvarlig for oplysningerne i Bagscenen. Spørgsmål rettes til koordinatoren
          {contact ? (
            <>
              {" "}
              på <a href={`mailto:${contact}`} className="underline underline-offset-2">{contact}</a>
            </>
          ) : null}
          . Du kan også kontakte {ORG.name}s databeskyttelsesrådgiver — {ORG.dpoHint}.
        </p>
      </Section>

      <Section title="Formål">
        <p>
          Bagscenen bruges til at planlægge studentermedhjælpere til arrangementer på {ORG.name}: hvem hjælper
          hvornår, hvad arrangementet kræver, og hvem man skal kontakte.
        </p>
      </Section>

      <Section title="Studentermedhjælpere: hvad vi gemmer">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fornavn, efternavn, {ORG.emailLabel} og telefonnummer</li>
          <li>Dine svar på arrangementer (hvilke vagter og tidsrum du tager, eller at du ikke kan), og de noter du selv skriver</li>
          <li>En log over handlinger i systemet (fx at du loggede ind eller tog en vagt)</li>
          <li>Din adgangskode — kun som et envejs-hash, som ingen kan læse</li>
        </ul>
        <p>
          Retsgrundlaget er databeskyttelsesforordningens art. 6, stk. 1, litra e (universitetets opgaver) og — når du er
          ansat som studentermedhjælper — litra b (ansættelsesforholdet). Behandlingen er ikke baseret på samtykke.
        </p>
      </Section>

      <Section title="Arrangører" id="arrangoerer">
        <p>
          Når du bestiller hjælp eller står som kontaktperson på et arrangement, gemmer vi dit navn, din e-mail, dit
          telefonnummer og evt. institut samt det, du skriver om arrangementet. Det bruges kun til at planlægge
          arrangementet, og studentermedhjælperne på arrangementet kan se dine kontaktoplysninger, så de kan koordinere
          direkte med dig. Retsgrundlaget er art. 6, stk. 1, litra e.
        </p>
        <p>
          Bands&apos; techriders (PDF) kan indeholde kontaktoplysninger. De kan kun hentes af koordinatorer og medhjælpere
          på arrangementet — aldrig via det offentlige QR-link til kanalplanen.
        </p>
      </Section>

      <Section title="Hvem kan se oplysningerne">
        <ul className="list-disc space-y-1 pl-5">
          <li>Koordinatorer (admin og tovholdere) kan se brugere og alle arrangementer.</li>
          <li>
            Medhjælpere, der er på samme arrangement, kan se hinandens navn, telefonnummer og tidsrum. Medhjælpere, der ikke
            selv er på, ser kun navne og tidsrum — ikke telefonnumre.
          </li>
          <li>
            Systemet drives hos databehandlere: Vercel Inc. (hosting) og Neon Inc. (database). Data opbevares i EU
            (Frankfurt). Leverandørerne er amerikanske og er omfattet af EU-U.S. Data Privacy Framework og EU&apos;s
            standardkontraktbestemmelser.
          </li>
        </ul>
        <p>Oplysningerne videregives ikke til andre og bruges ikke til markedsføring.</p>
      </Section>

      <Section title="Hvor længe gemmer vi dem">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tilmeldinger, der ikke bliver godkendt, slettes efter {r.pendingSignupDays} dage.</li>
          <li>Deaktiverede konti anonymiseres efter {r.disabledUserDays} dage. Du kan selv slette din konto når som helst.</li>
          <li>
            Kontaktpersoner, noter og techriders på et arrangement slettes {r.eventPersonalDataDays} dage efter
            arrangementet. Selve arrangementet (teknik og vagter) bevares uden personoplysninger.
          </li>
          <li>Bestillinger, der ikke bliver til et arrangement, slettes efter {r.requestDays} dage.</li>
          <li>Loggen slettes efter {r.auditLogDays} dage.</li>
        </ul>
        <p>Oprydningen sker automatisk hver nat.</p>
      </Section>

      <Section title="Cookies og lokal lagring">
        <p>
          Bagscenen bruger kun én cookie, som er nødvendig for at holde dig logget ind. Dit valg af lyst/mørkt tema gemmes
          lokalt i din browser. Der er ingen statistik, reklame eller sporing.
        </p>
      </Section>

      <Section title="Dine rettigheder">
        <ul className="list-disc space-y-1 pl-5">
          <li>Indsigt og dataportabilitet: under “Profil” kan du downloade alle dine oplysninger.</li>
          <li>Berigtigelse: du kan selv rette navn og telefonnummer under “Profil”.</li>
          <li>Sletning: du kan selv slette din konto under “Profil”.</li>
          <li>Du kan også bede om begrænsning af behandlingen eller gøre indsigelse.</li>
          <li>
            Du kan klage til Datatilsynet (
            <a href="https://www.datatilsynet.dk" className="underline underline-offset-2" rel="noopener noreferrer">
              datatilsynet.dk
            </a>
            ).
          </li>
        </ul>
      </Section>

      <Section title="Sikkerhed">
        <p>
          Adgang kræver login med {ORG.emailLabel} og godkendelse af en koordinator. Forbindelsen er krypteret, adgangskoder gemmes
          som hash, links udløber og kan kun bruges af den rette, og alle administrative handlinger logges.
        </p>
      </Section>

      <p>
        <Link href="/login" className="underline underline-offset-2">
          Tilbage
        </Link>
      </p>
    </article>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
