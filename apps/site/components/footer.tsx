import Link from "next/link";

import { siteLinks } from "@/lib/site-config";

const PRODUCT_LINKS = [
  { label: "useThread", href: "/threads" },
  { label: "Demo", href: siteLinks.demo },
  { label: "Desktop App", href: siteLinks.desktop },
  { label: "Documentation", href: siteLinks.docs },
  { label: "Getting Started", href: siteLinks.docsGettingStarted },
];

const COMMUNITY_LINKS = [
  {
    label: "GitHub",
    href: siteLinks.github,
  },
  { label: "X / Twitter", href: "https://x.com/franmoretti_" },
];

export function Footer() {
  return (
    <footer className="border-border/40 border-t">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div>
            <Link
              className="flex items-center gap-2.5 font-semibold text-lg tracking-tight"
              href="/"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 383.57 404.66"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>ChatJS</title>
                <path
                  d="M199.24,382.33c-31.76-.28-57.8-4.89-82.57-15.76a5,5,0,0,0-5.08.45,759,759,0,0,1-69,35.41,28.59,28.59,0,0,1-4.82,1.82c-7.38,1.9-12.5-3.12-10.18-10.34,6.87-21.46,15.7-42.2,24-63.11,1.7-4.27,1.64-7-1.81-10.67C14.16,282.32-1.37,236.59.09,185.39,2.8,90.7,74.07,13.33,168.19,1.5A191.73,191.73,0,0,1,367.93,115.31c49,113-22.2,244.36-143.53,264.68C214.51,381.65,204.49,382.54,199.24,382.33Z"
                  fill="currentColor"
                />
                <path
                  className="fill-background"
                  d="M226.88,288.71c-3.9-.64-5.17-3.31-5.56-6.86-1.69-15.65-3-31.38-7.34-46.59-9.19-32.27-32.1-47.92-64-52.52-5.66-.82-11.32-1.61-17-2.51-2.84-.45-4.89-1.93-4.83-5.09s2.2-4.3,4.8-4.83c10-2,20.26-3.37,30.08-6.15,34.08-9.64,50.32-34.14,55-67.78,1.41-10,2.54-20.11,3.86-30.16.39-3,1.59-5.84,5-5.74s4.53,3,4.91,6.16c2,17.22,2.67,34.72,8.64,51.23,11,30.32,34.34,44.55,64.86,49.3,5.85.91,11.68,2,17.45,3.25,2.27.51,4.73,1.58,4.56,4.64s-2.54,4-5.08,4.55c-10.1,2.15-20.41,3.22-30.42,6-32.47,8.93-50,30.91-55.53,63.3-1.92,11.25-3,22.65-4.56,34C231.37,285.71,230.55,288.43,226.88,288.71Z"
                />
                <path
                  className="fill-background"
                  d="M124.05,151.66a1.19,1.19,0,0,1-2.31,0s0,0,0-.08c-2.31-11.51-8.66-19.23-20.42-22-.91-.21-2.19-.62-2-1.72.13-.63,1.33-1.28,2.17-1.5,11.51-3,18.32-10.3,20.2-22.12.14-.87,0-2.3,1.28-2.22.68,0,.68,1,.86,2.17,1.92,12.11,9.22,19.3,21,22.14.94.22,2,.43,2.06,1.68s-1.07,1.49-2,1.69C133,132.3,126.43,140,124.06,151.63Z"
                />
                <path
                  className="fill-background"
                  d="M107.61,261a1.19,1.19,0,0,1-2.31,0s0-.05,0-.08c-2.31-11.51-8.66-19.23-20.42-22-.91-.21-2.19-.62-2-1.72.13-.63,1.34-1.28,2.17-1.5,11.51-3,18.32-10.3,20.2-22.12.14-.87,0-2.3,1.28-2.22.68,0,.68,1,.86,2.17,1.92,12.11,9.22,19.3,21,22.14.94.22,2,.43,2.06,1.68s-1.07,1.49-2,1.69C116.55,241.65,110,249.31,107.62,261Z"
                />
              </svg>
              ChatJS
            </Link>
            <p className="mt-3 max-w-xs text-foreground/75 text-sm leading-relaxed">
              The open-source, production-ready AI chat foundation.
            </p>
          </div>

          {/* Link columns */}
          <nav
            aria-labelledby="footer-navigation-heading"
            className="flex gap-16"
          >
            <h2 className="sr-only" id="footer-navigation-heading">
              Footer navigation
            </h2>
            <div>
              <h3 className="font-medium text-sm">Product</h3>
              <ul className="mt-4 space-y-3">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      className="text-foreground/75 text-sm transition-colors hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-sm">Community</h3>
              <ul className="mt-4 space-y-3">
                {COMMUNITY_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      className="text-foreground/75 text-sm transition-colors hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-border/40 border-t pt-6">
          <p className="text-foreground/65 text-sm">
            &copy; {new Date().getFullYear()} ChatJS. Open source under the
            Apache 2.0 license.
          </p>
        </div>
      </div>
    </footer>
  );
}
