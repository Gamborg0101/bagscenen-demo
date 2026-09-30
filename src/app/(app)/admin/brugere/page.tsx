import type { Role, User } from "@prisma/client";
import { buttonClass } from "@/components/styles";
import { db } from "@/lib/db";
import { canManageUser } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";
import { approveUser, eraseUser, rejectUser, setUserStatus } from "./actions";
import { ResetLinkButton } from "./reset-link-button";
import { RoleSelect } from "./role-select";

export const metadata = { title: "Brugere · Bagscenen" };

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", LEAD: "Tovholder", HELPER: "Medhjælper" };

type Row = Pick<User, "id" | "firstName" | "lastName" | "email" | "phone" | "role" | "status">;

export default async function UsersPage() {
  const actor = await requireUser("LEAD");
  const users = await db.user.findMany({
    where: { anonymizedAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true },
  });

  const pending = users.filter((u) => u.status === "PENDING");
  const active = users.filter((u) => u.status === "ACTIVE");
  const disabled = users.filter((u) => u.status === "DISABLED");

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Brugere</h1>
        <dl className="grid gap-x-3 gap-y-1.5 rounded-lg border border-line p-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="font-medium">Medhjælper</dt>
          <dd className="text-muted">Ser kommende arrangementer, tager vagter eller siger “kan ikke”, og kan redigere kanalplaner på de arrangementer, de er på.</dd>
          <dt className="font-medium">Tovholder</dt>
          <dd className="text-muted">Som medhjælper, og kan desuden oprette og redigere arrangementer og bestillinger, sætte folk på vagter, godkende nye brugere og lave nulstillingslinks.</dd>
          <dt className="font-medium">Admin</dt>
          <dd className="text-muted">Som tovholder, og kan desuden ændre roller, se loggen og slette deaktiverede brugeres data.</dd>
        </dl>
      </div>

      <Section title="Afventer godkendelse" count={pending.length} empty="Ingen nye tilmeldinger.">
        {pending.map((u) => (
          <UserRow key={u.id} user={u}>
            <IdForm action={approveUser} userId={u.id}>
              <button className={buttonClass("primary", "sm")}>Godkend</button>
            </IdForm>
            <IdForm action={rejectUser} userId={u.id}>
              <button className={buttonClass("danger", "sm")}>Afvis</button>
            </IdForm>
          </UserRow>
        ))}
      </Section>

      <Section title="Aktive" count={active.length} empty="Ingen aktive brugere.">
        {active.map((u) => (
          <UserRow key={u.id} user={u}>
            {canManageUser(actor, u) && <ManageActions actor={actor} user={u} />}
          </UserRow>
        ))}
      </Section>

      {disabled.length > 0 && (
        <Section title="Deaktiverede" count={disabled.length}>
          {disabled.map((u) => (
            <UserRow key={u.id} user={u} dim>
              {canManageUser(actor, u) && (
                <>
                  <IdForm action={setUserStatus} userId={u.id}>
                    <input type="hidden" name="status" value="ACTIVE" />
                    <button className={buttonClass("secondary", "sm")}>Genaktivér</button>
                  </IdForm>
                  {actor.role === "ADMIN" && (
                    <IdForm action={eraseUser} userId={u.id}>
                      <button className={buttonClass("danger", "sm")} title="Sletter navn, mail og telefon permanent">
                        Slet data
                      </button>
                    </IdForm>
                  )}
                </>
              )}
            </UserRow>
          ))}
        </Section>
      )}
    </div>
  );
}

function ManageActions({ actor, user }: { actor: CurrentUser; user: Row }) {
  return (
    <>
      {actor.role === "ADMIN" && (
        <RoleSelect userId={user.id} role={user.role} />
      )}
      <ResetLinkButton userId={user.id} />
      <IdForm action={setUserStatus} userId={user.id}>
        <input type="hidden" name="status" value="DISABLED" />
        <button className={buttonClass("danger", "sm")}>Deaktivér</button>
      </IdForm>
    </>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">{children}</ul>
      )}
    </section>
  );
}

function UserRow({ user, dim, children }: { user: Row; dim?: boolean; children?: React.ReactNode }) {
  return (
    <li className={`flex flex-col gap-3 py-3 sm:flex-row sm:items-center ${dim ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {user.firstName} {user.lastName}
          {user.role !== "HELPER" && (
            <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs font-normal text-muted">
              {ROLE_LABEL[user.role]}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          <a href={`mailto:${user.email}`} className="hover:text-fg">
            {user.email}
          </a>
          {" · "}
          <a href={`tel:${user.phone}`} className="hover:text-fg">
            {user.phone}
          </a>
        </p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </li>
  );
}

function IdForm({
  action,
  userId,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      {children}
    </form>
  );
}
