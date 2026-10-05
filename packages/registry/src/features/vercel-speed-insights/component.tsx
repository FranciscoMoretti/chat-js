import { SpeedInsights } from "@vercel/speed-insights/next";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { InstalledLayoutComponent } from "@/lib/installation-contracts";
/* oxlint-enable sort-imports */

export const Component = SpeedInsights satisfies InstalledLayoutComponent;
