import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex justify-end p-3">
        <ThemeToggle />
      </div>
      <main className="mx-auto w-full max-w-sm flex-1 px-4 pt-8 pb-16">
        <p className="mb-8 text-base font-semibold tracking-tight">Bagscenen</p>
        {children}
      </main>
    </div>
  );
}
