import { redirect } from "next/navigation";
import { buttonClass } from "@/components/styles";
import { currentUser } from "@/lib/session";
import { logoutAction } from "../actions";

export const metadata = { title: "Afventer godkendelse · Bagscenen" };

export default async function PendingPage() {
  const user = await currentUser();
  if (!user || user.status === "DISABLED" || user.anonymizedAt) redirect("/login");
  if (user.status === "ACTIVE") redirect("/");

  return (
    <>
      <h1 className="mb-2 text-xl font-semibold tracking-tight">Tak, {user.firstName}</h1>
      <p className="mb-6 text-muted">
        Din konto er oprettet og afventer godkendelse fra en koordinator. Når den er godkendt, kan du
        se dine invitationer her.
      </p>
      <form action={logoutAction}>
        <button className={buttonClass("secondary")}>Log ud</button>
      </form>
    </>
  );
}
