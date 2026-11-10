import { Github } from "lucide-react";
import Link from "next/link";

import { Brand } from "./brand";
import { docsNavigationHref, siteLinks } from "@/lib/site-config";

export const Navbar = () => (
  <header className="carbon-wrap carbon-nav">
    <Brand />
    <nav aria-label="Main">
      <a href={docsNavigationHref}>Docs</a>
      <a href={siteLinks.demo}>Demo</a>
      <Link className="carbon-nav-create" href="/create">
        Create
      </Link>
      <a
        className="carbon-nav-github"
        href={siteLinks.github}
        aria-label="GitHub"
        title="ChatJS on GitHub"
      >
        {/* oxlint-disable-next-line typescript/no-deprecated -- Use the GitHub glyph from the pinned Lucide release. */}
        <Github size={17} aria-hidden="true" />
      </a>
    </nav>
  </header>
);
