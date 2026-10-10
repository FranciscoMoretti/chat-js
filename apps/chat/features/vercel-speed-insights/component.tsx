import type { InstalledLayoutComponent } from "@/lib/installation-contracts";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Component); the enabled import/no-default-export convention rejects the default-export alternative. */
import { SpeedInsights } from "@vercel/speed-insights/next";

export const Component = SpeedInsights satisfies InstalledLayoutComponent;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
