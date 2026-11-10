import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Brand } from "./brand";
import { docsNavigationHref, siteLinks } from "@/lib/site-config";

export const Footer = () => (
  <footer className="carbon-wrap carbon-footer">
    <Brand />
    <span>The foundation for your AI app.</span>
    <nav aria-label="Footer">
      <a href={docsNavigationHref}>Documentation</a>
      <Link href="/threads">Thread library</Link>
      <a href={siteLinks.github}>
        GitHub <ArrowUpRight size={12} aria-hidden="true" />
      </a>
    </nav>
  </footer>
);
