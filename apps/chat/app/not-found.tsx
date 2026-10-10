import React from "react";

/* oxlint-disable sort-imports -- Alphabetical sorting places Button before InternalLink; keep the existing component module evaluation order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Alphabetical sorting places Button before InternalLink; keep the existing component module evaluation order. */
import { Button } from "@/components/ui/button";
/* oxlint-disable react/jsx-no-literals -- NotFound renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */

/* oxlint-disable react/jsx-max-depth -- * react/jsx-max-depth (#548): native control found four sites nested to depth 4 or 5 (limit 2); the nested containers provide the centered error-page layout. */
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default NotFound;
/* oxlint-enable import/no-default-export */
