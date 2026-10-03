/* oxlint-disable import/max-dependencies  --
 * import/max-dependencies (#524): import from "react" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
/* oxlint-enable import/max-dependencies */

/* oxlint-disable import/exports-last, import/group-exports, react/only-export-components  --
 * import/exports-last (#522): metadata is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): metadata stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named metadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): metadata is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const metadata: Metadata = {
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
/* oxlint-enable import/exports-last, import/group-exports, react/only-export-components */

/* oxlint-disable import/exports-last, import/group-exports, react/only-export-components  --
 * import/exports-last (#522): viewport is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): viewport stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named viewport API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): viewport is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const viewport = {
  interactiveWidget: "resizes-content" as const,
  // Disable auto-zoom on mobile Safari
  maximumScale: 1,
};
/* oxlint-enable import/exports-last, import/group-exports, react/only-export-components */

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

/* oxlint-disable node/no-process-env, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * no-ternary (#518): RootLayout derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-process-env (#537): RootLayout reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * react/jsx-max-depth (#548): RootLayout keeps related render components together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): RootLayout accepts { children, }: Readonly<{ children: React.ReactNode; }>; { id, Component }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): RootLayout intentionally keeps the existing falsy-value behavior of process.env.PLAYWRIGHT; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): RootLayout preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element => (
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
      !process.env.PLAYWRIGHT &&
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
      {installedLayoutComponents.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </body>
  </html>
);
/* oxlint-enable node/no-process-env, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default RootLayout;
/* oxlint-enable import/no-default-export */
