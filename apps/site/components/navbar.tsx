import Link from "next/link";

import { siteLinks } from "@/lib/site-config";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { label: "Threads", href: "/threads" },
  { label: "Demo", href: siteLinks.demo },
  { label: "Docs", href: siteLinks.docs },
  {
    label: "GitHub",
    href: siteLinks.github,
  },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/40 border-b bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          className="flex items-center gap-2.5 font-semibold text-lg tracking-tight"
          href="/"
        >
          <svg
            className="h-7 w-7"
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

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              className="text-foreground/75 text-sm transition-colors hover:text-foreground"
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
          <ThemeToggle />
        </div>

        {/* Mobile toggle */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg p-2 text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground">
            <span className="sr-only">Toggle menu</span>
            <span aria-hidden="true" className="text-sm">
              Menu
            </span>
          </summary>

          <div className="absolute inset-x-0 top-full w-[min(18rem,calc(100vw-3rem))] rounded-2xl border border-border/40 bg-background/95 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  className="text-foreground/75 text-sm transition-colors hover:text-foreground"
                  href={link.href}
                  key={link.label}
                >
                  {link.label}
                </a>
              ))}
              <ThemeToggle />
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}
