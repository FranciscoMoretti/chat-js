import { ArrowUpRight } from "lucide-react";
import { siteLinks } from "@/lib/site-config";

export const DemoLink = () => (
  <a
    aria-label="Demo (opens in a new tab)"
    href={siteLinks.demo}
    rel="noopener noreferrer"
    target="_blank"
  >
    <span>
      Demo
      <ArrowUpRight
        aria-hidden="true"
        className="ms-px inline-block size-[0.7em] align-[0.25em] opacity-70"
      />
    </span>
  </a>
);
