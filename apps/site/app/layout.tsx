import { Analytics } from "@vercel/analytics/next";
/* oxlint-disable eslint/sort-imports -- the next import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { Metadata, Viewport } from "next";
/* oxlint-enable eslint/sort-imports */
import { ThemeProvider } from "next-themes";
/* oxlint-disable eslint/sort-imports -- the next/font/google import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
/* oxlint-enable eslint/sort-imports */
import React from "react";

import { siteConfig } from "@/lib/site-config";

/* oxlint-disable eslint/sort-imports -- the ./globals.css import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import "./globals.css";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/exports-last -- metadata: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- metadata: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable react/only-export-components -- metadata: The route/scene module exports metadata or helpers required alongside its component by existing consumers. */
/* oxlint-disable import/no-named-export -- metadata: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": `${siteConfig.docsUrl}/rss.xml`,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.shortName,
  },
  applicationName: siteConfig.name,
  authors: [{ name: "Francisco Moretti" }],
  category: "technology",
  creator: "Francisco Moretti",
  description: siteConfig.description,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  keywords: [...siteConfig.keywords],
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.description,
    images: [
      {
        alt: "ChatJS AI chat application interface preview",
        height: 630,
        url: siteConfig.ogImage,
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: siteConfig.name,
    title: `${siteConfig.title} — The Prod-Ready AI Chat App`,
    type: "website",
    url: siteConfig.url,
  },
  publisher: siteConfig.name,
  title: {
    default: `${siteConfig.title} — The Prod-Ready AI Chat App`,
    template: `%s | ${siteConfig.title}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: siteConfig.creator,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    title: `${siteConfig.title} — The Prod-Ready AI Chat App`,
  },
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- viewport: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- viewport: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable react/only-export-components -- viewport: The route/scene module exports metadata or helpers required alongside its component by existing consumers. */
/* oxlint-disable import/no-named-export -- viewport: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const viewport: Viewport = {
  initialScale: 1,
  themeColor: [
    { color: "#f8f7f4", media: "(prefers-color-scheme: light)" },
    { color: "#09090b", media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

const geist = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const instrumentSerif = Instrument_Serif({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
});

/* oxlint-disable typescript/prefer-readonly-parameter-types -- RootLayout: React/library props and refs retain their declared mutability contract; deep-readonly wrapping would change assignability. */
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element => (
  <html
    className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    lang="en"
    suppressHydrationWarning
  >
    <body className="antialiased">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        {children}
      </ThemeProvider>
      <Analytics />
    </body>
  </html>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-default-export -- layout.tsx: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
export default RootLayout;
/* oxlint-enable import/no-default-export */
