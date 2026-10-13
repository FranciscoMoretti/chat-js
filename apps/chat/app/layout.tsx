import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";
import React from "react";
import { Toaster } from "sonner";

import { ElectronAuthHandler } from "@/components/electron-auth-handler";
import { ThemeProvider } from "@/components/theme-provider";
import { installedLayoutComponents } from "@/features/installed-layout";
import { config } from "@/lib/config";
import { env } from "@/lib/env";

const metadata: Metadata = {
  description: config.appDescription,
  metadataBase: new URL(config.appUrl),
  openGraph: {
    description: config.appDescription,
    siteName: config.appName,
    title: config.appTitle ?? config.appName,
    url: config.appUrl,
  },
  title: config.appTitle ?? config.appName,
};

const viewport = {
  interactiveWidget: "resizes-content",
  // Disable auto-zoom on mobile Safari
  maximumScale: 1,
} satisfies Viewport;

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

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

const RootLayout = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => (
  <html
    className={`${geist.variable} ${geistMono.variable}`}
    // `next-themes` injects an extra classname to the body element to avoid
    // visual flicker before hydration. Hence the `suppressHydrationWarning`
    // prop is necessary to avoid the React hydration mismatch warning.
    // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
    lang="en"
    suppressHydrationWarning
  >
    <head>
      <Script id="theme-color-script" strategy="beforeInteractive">
        {THEME_COLOR_SCRIPT}
      </Script>
      {process.env.NODE_ENV === "development" &&
      (process.env.PLAYWRIGHT ?? "") === "" &&
      env.NEXT_PUBLIC_REACT_SCAN === "1" ? (
        <Script
          src="https://unpkg.com/react-scan/dist/auto.global.js"
          strategy="beforeInteractive"
        />
      ) : null}
    </head>
    <body className="antialiased">
      <ElectronAuthHandler />
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="afterInteractive"
      />
      <NuqsAdapter>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Toaster position="top-center" />
          {children}
        </ThemeProvider>
      </NuqsAdapter>
      {installedLayoutComponents.map(
        ({
          id,
          Component,
        }: {
          readonly id: string;
          readonly Component: React.JSXElementConstructor<
            Readonly<React.Attributes>
          >;
        }) => (
          <Component key={id} />
        )
      )}
    </body>
  </html>
);

export { metadata, viewport };
export default RootLayout;
