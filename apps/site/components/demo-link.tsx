import { ArrowUpRight } from "lucide-react";
import { siteLinks } from "@/lib/site-config";

export const DemoLink = () => (
  <a
    aria-label="Demo (opens in a new tab)"
    className="gap-1"
    href={siteLinks.demo}
    rel="noopener noreferrer"
    target="_blank"
  >
    Demo
    <ArrowUpRight aria-hidden="true" size={13} />
  </a>
);
