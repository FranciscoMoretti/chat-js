/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { BookOpen } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */

const DOCS_URL = "https://chatjs.dev/docs";
/* oxlint-disable import/no-named-export, import/prefer-default-export -- DocsLink: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export const DocsLink = (): React.JSX.Element => (
  <Button asChild size="icon" type="button" variant="ghost">
    <a
      aria-label="Open documentation"
      className="flex items-center justify-center"
      href={DOCS_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <BookOpen size={20} />
    </a>
  </Button>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export */
