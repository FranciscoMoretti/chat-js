import type { ReactNode } from "react";
import { installedAuthenticationForms } from "@/chatjs/generated/installed-auth-ui";
import type { AuthenticationUi } from "@/lib/authentication-contracts";
import { selectIntegration } from "@/lib/select-integration";

export const AuthenticationForm: AuthenticationUi["Form"] =
  selectIntegration("authentication form", installedAuthenticationForms) ??
  (({ children }): ReactNode => children);
