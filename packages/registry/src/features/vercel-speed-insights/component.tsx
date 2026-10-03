import { SpeedInsights } from "@vercel/speed-insights/next";

import type { InstalledLayoutComponent } from "@/lib/installation-contracts";

export const Component = SpeedInsights satisfies InstalledLayoutComponent;
