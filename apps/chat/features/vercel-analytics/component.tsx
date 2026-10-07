import { Analytics } from "@vercel/analytics/next";

import type { InstalledLayoutComponent } from "@/lib/installation-contracts";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Component); the enabled import/no-default-export convention rejects the default-export alternative. */
export const Component = Analytics satisfies InstalledLayoutComponent;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
