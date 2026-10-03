/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import React from "react";

import { InternalLink } from "@/components/internal-link";
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */

/* oxlint-disable react/jsx-max-depth, react/jsx-no-literals --
 * react/jsx-max-depth (#548): NotFound keeps related render components together; extraction changes component, state, and layout boundaries.
 * react/jsx-no-literals (#549): NotFound owns this page copy; replacing literal text requires a localization/content-management contract.
 */
const NotFound = (): React.JSX.Element => (
  <div className="bg-background min-h-screen">
    <div className="container mx-auto p-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="text-foreground text-4xl font-semibold">404</h1>
          <h2 className="text-muted-foreground text-xl">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild>
            <InternalLink href="/">Return Home</InternalLink>
          </Button>
        </div>
      </div>
    </div>
  </div>
);
/* oxlint-enable react/jsx-max-depth, react/jsx-no-literals */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default NotFound;
/* oxlint-enable import/no-default-export */
