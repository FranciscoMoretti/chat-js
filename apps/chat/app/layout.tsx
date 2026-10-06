/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "react" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import type { Metadata } from "next";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Geist, Geist_Mono } from "next/font/google";
/* oxlint-enable sort-imports */
import Script from "next/script";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { NuqsAdapter } from "nuqs/adapters/next/app";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "./globals.css";
/* oxlint-enable sort-imports */
import React from "react";
import { Toaster } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ElectronAuthHandler } from "@/components/electron-auth-handler";
/* oxlint-enable sort-imports */
import { ThemeProvider } from "@/components/theme-provider";
import { installedLayoutComponents } from "@/features/installed-layout";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */
import { env } from "@/lib/env";
/* oxlint-enable import/max-dependencies */

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
  interactiveWidget: "resizes-content" as const,
  // Disable auto-zoom on mobile Safari
  maximumScale: 1,
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

/* oxlint-disable node/no-process-env, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
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
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        process.env.NODE_ENV === "development" &&
        !process.env.PLAYWRIGHT &&
        env.NEXT_PUBLIC_REACT_SCAN === "1" ? (
          <Script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="beforeInteractive"
          />
        ) : null
      }
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
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata, viewport); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable node/no-process-env, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata, viewport };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default RootLayout;
/* oxlint-enable import/no-default-export */
