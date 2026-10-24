import type { InstalledLayoutComponent } from "@/lib/installation-contracts";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const Component = SpeedInsights satisfies InstalledLayoutComponent;
