/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { GitIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */

const GITHUB_URL = "https://github.com/franciscomoretti/chat-js";
/* oxlint-disable import/no-named-export, import/prefer-default-export -- GitHubLink: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export const GitHubLink = (): React.JSX.Element => (
  <Button asChild size="icon" type="button" variant="ghost">
    <a
      className="flex items-center justify-center"
      href={GITHUB_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <GitIcon size={20} />
    </a>
  </Button>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export */
