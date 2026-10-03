import { BookOpen } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";

const DOCS_URL = "https://chatjs.dev/docs";

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
