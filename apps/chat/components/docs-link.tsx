import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

import React from "react";

const DOCS_URL = "https://chatjs.dev/docs";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DocsLink); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
