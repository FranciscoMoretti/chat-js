import { buttonVariants } from "@/components/ui/button";

import { GitIcon } from "@/components/icons";

import React from "react";

const GITHUB_URL = "https://github.com/franciscomoretti/chat-js";

export const GitHubLink = (): React.JSX.Element => (
  <a
    aria-label="Open GitHub repository"
    className={buttonVariants({ size: "icon", variant: "ghost" })}
    href={GITHUB_URL}
    rel="noopener noreferrer"
    target="_blank"
  >
    <GitIcon size={20} />
  </a>
);
