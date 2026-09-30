import { ResetForm } from "./reset-form";

export const metadata = { title: "Ny adgangskode · Bagscenen" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Vælg ny adgangskode</h1>
      <ResetForm token={token} />
    </>
  );
}
