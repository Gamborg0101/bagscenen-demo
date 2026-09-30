"use client";

import type { Role } from "@prisma/client";
import { setUserRole } from "./actions";

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", LEAD: "Tovholder", HELPER: "Medhjælper" };

/** Changing the role saves straight away — no separate save button. */
export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  return (
    <form action={setUserRole}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        aria-label="Rolle"
        className="rounded-md border border-line bg-bg px-2 py-1.5 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </form>
  );
}
