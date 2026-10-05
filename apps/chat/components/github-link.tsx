import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { GitIcon } from "@/components/icons";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */

const GITHUB_URL = "https://github.com/franciscomoretti/chat-js";

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
