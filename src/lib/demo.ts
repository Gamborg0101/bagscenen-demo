import { DEMO_USERS } from "./demo-users";

// Public demo mode (DEMO_MODE=1): one-click logins, no signup, fictional data reset every night.
// Never set on the real deployment.
export const isDemo = () => process.env.DEMO_MODE === "1";

export const DEMO_DISABLED_MESSAGE = "Det er slået fra i demoen.";

/** The shared demo accounts can't be changed in ways that would lock other visitors out. */
export function isDemoAccount(userId: string): boolean {
  return isDemo() && Object.values(DEMO_USERS).some((u) => u.id === userId);
}
