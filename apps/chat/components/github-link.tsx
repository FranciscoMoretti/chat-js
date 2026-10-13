import { Button } from "@/components/ui/button";

import { GitIcon } from "@/components/icons";

import React from "react";

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
