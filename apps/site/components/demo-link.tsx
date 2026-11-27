import { siteLinks } from "@/lib/site-config";

export const DemoLink = () => (
  <a
    aria-label="Live demo (opens in a new tab)"
    className="demo-link"
    href={siteLinks.demo}
    rel="noopener noreferrer"
    target="_blank"
  >
    Live demo
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path d="M1 9 9 1M3 1h6v6" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  </a>
);
