import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import React from "react";
import { ThemeProvider } from "next-themes";

import { siteConfig } from "@/lib/site-config";

/* oxlint-disable sort-imports -- Keep the root global stylesheet last so its CSS remains after imported module styles in Next.js CSS chunk order. */
import "./globals.css";
/* oxlint-enable sort-imports */

const metadata: Metadata = {
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

const viewport: Viewport = {
  initialScale: 1,
  themeColor: [
    { color: "#f8f7f4", media: "(prefers-color-scheme: light)" },
    { color: "#09090b", media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
};

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

type ReadonlyReactIteratorResult =
  | { readonly done?: false; readonly value: ReadonlyReactNode }
  | { readonly done: true; readonly value: unknown };
interface ReadonlyReactIterator {
  readonly next: () => ReadonlyReactIteratorResult;
  readonly [Symbol.iterator]?: () => ReadonlyReactIterator;
}
interface ReadonlyReactIterable {
  readonly [Symbol.iterator]: () => ReadonlyReactIterator;
}
type ReadonlyAwaitedNode =
  | Readonly<React.ReactElement>
  | string
  | number
  | bigint
  | ReadonlyReactIterable
  | (Omit<Readonly<React.ReactPortal>, "children"> & {
      readonly children: ReadonlyReactNode;
    })
  | boolean
  | null
  | undefined;
type ReadonlyReactNode =
  | ReadonlyAwaitedNode
  | Readonly<Promise<ReadonlyAwaitedNode>>;

const RootLayout = ({
  children,
}: Readonly<{
  children: ReadonlyReactNode;
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
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata, viewport); the enabled import/no-default-export convention rejects the default-export alternative. */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata, viewport };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default RootLayout;
/* oxlint-enable import/no-default-export */
