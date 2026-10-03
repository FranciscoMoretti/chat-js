import { Analytics } from "@vercel/analytics/next";

import type { InstalledLayoutComponent } from "@/lib/installation-contracts";

export const Component = Analytics satisfies InstalledLayoutComponent;
