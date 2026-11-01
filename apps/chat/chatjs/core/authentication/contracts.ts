import type { BetterAuthPlugin } from "better-auth";
import type { ComponentType, ReactNode } from "react";

export interface AuthenticationIntegration {
  readonly plugins: readonly BetterAuthPlugin[];
  readonly trustedOrigins: readonly string[];
  /** Auth flows that remain reachable even with an existing session. */
  readonly isAuthRoute: (
    url: Readonly<Pick<URL, "pathname" | "searchParams">>
  ) => boolean;
}
export interface AuthenticationUi {
  readonly Form: ComponentType<{
    readonly mode: "login" | "register";
    readonly children: ReactNode;
  }>;
  /** Return false to use normal web sign-out. Reject if sign-out failed. */
  readonly signOut: () => Promise<boolean>;
}
