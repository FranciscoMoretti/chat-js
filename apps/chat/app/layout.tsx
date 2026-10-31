import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";
import components from "@/components.json";
import { UiDirection } from "@/providers/ui-direction";
import React from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutPlugins } from "@/components/layout-plugins";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
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
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono",
});

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
    meta.setAttribute('content', getComputedStyle(html).getPropertyValue('--background').trim());
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
    className={cn(geist.variable, geistMono.variable, "font-sans")}
    // `next-themes` injects an extra classname to the body element to avoid
    // visual flicker before hydration. Hence the `suppressHydrationWarning`
    // prop is necessary to avoid the React hydration mismatch warning.
    // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
    dir={components.rtl ? "rtl" : "ltr"}
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
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="afterInteractive"
      />
      <UiDirection direction={components.rtl ? "rtl" : "ltr"}>
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            <TooltipProvider>
              <Toaster position="top-center" />
              {children}
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </UiDirection>
      <LayoutPlugins />
    </body>
  </html>
);

export { metadata, viewport };
export default RootLayout;
