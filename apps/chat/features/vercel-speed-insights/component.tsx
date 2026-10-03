import { SpeedInsights } from "@vercel/speed-insights/next";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { InstalledLayoutComponent } from "@/lib/installation-contracts";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const Component = SpeedInsights satisfies InstalledLayoutComponent;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
