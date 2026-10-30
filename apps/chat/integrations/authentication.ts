import { installedAuth } from "@/chatjs/generated/installed-auth";
import type { AuthenticationIntegration } from "@/lib/authentication-contracts";
import { selectIntegration } from "@/lib/select-integration";

export const authentication: AuthenticationIntegration = selectIntegration(
  "authentication",
  installedAuth
) ?? {
  plugins: [],
  trustedOrigins: [],
  isAuthRoute: () => false,
};
