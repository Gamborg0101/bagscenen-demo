import { buttonClass } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "Profil · Bagscenen" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Profil</h1>
          <p className="text-xs text-muted">{user.email}</p>
        </div>
      </div>

      <Block title="Oplysninger">
        <ProfileForm firstName={user.firstName} lastName={user.lastName} phone={user.phone} />
      </Block>

      <Block title="Skift adgangskode">
        <PasswordForm email={user.email} />
      </Block>

      <Block title="Dine data">
        <p className="mb-3 text-muted">Hent alt, hvad Bagscenen har registreret om dig, som en fil.</p>
        <a href="/profil/mine-data" className={buttonClass("secondary")} download>
          Download mine data
        </a>
      </Block>

      <Block title="Slet konto">
        <p className="mb-3 text-muted">
          Dit navn, din mail og dit telefonnummer slettes, og du bliver fjernet fra kommende arrangementer. Tidligere
          arrangementer bevares anonymt.
        </p>
        <DeleteAccountForm />
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-sm">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
