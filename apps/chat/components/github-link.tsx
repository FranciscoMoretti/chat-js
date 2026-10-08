import { Button } from "@/components/ui/button";

import { GitIcon } from "@/components/icons";

import React from "react";

const GITHUB_URL = "https://github.com/franciscomoretti/chat-js";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (GitHubLink); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
