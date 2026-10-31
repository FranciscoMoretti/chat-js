import type { ReactNode } from "react";
import { installedAuthenticationForms } from "@/chatjs/generated/installed-auth-ui";
import type { AuthenticationUi } from "@/chatjs/core/authentication/contracts";
import { selectIntegration } from "@/chatjs/core/installation/select";

export const AuthenticationForm: AuthenticationUi["Form"] =
  selectIntegration("authentication form", installedAuthenticationForms) ??
  (({ children }): ReactNode => children);
