import { installedAuth } from "@/chatjs/generated/installed-auth";
import type { AuthenticationIntegration } from "@/chatjs/core/authentication/contracts";
import { selectIntegration } from "@/chatjs/core/installation/select";

export const authentication: AuthenticationIntegration = selectIntegration(
  "authentication",
  installedAuth
) ?? {
  plugins: [],
  trustedOrigins: [],
  isAuthRoute: () => false,
};
