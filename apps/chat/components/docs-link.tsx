import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

import React from "react";

const DOCS_URL = "https://chatjs.dev/docs";

export const DocsLink = (): React.JSX.Element => (
  <a
    aria-label="Open documentation"
    className={buttonVariants({ size: "icon", variant: "ghost" })}
    href={DOCS_URL}
    rel="noopener noreferrer"
    target="_blank"
  >
    <BookOpen size={20} />
  </a>
);
