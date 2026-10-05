import type { Metadata } from "next";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Faq } from "@/components/faq";
/* oxlint-enable sort-imports */
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { LogoCloud } from "@/components/logo-cloud";
import { Navbar } from "@/components/navbar";
import { Platforms } from "@/components/platforms";
/* oxlint-disable import/max-dependencies -- the @/components/tech-stack import: The desktop main process coordinates window, auth, filesystem and IPC lifecycles; hiding imports would not separate those responsibilities. */
import { TechStack } from "@/components/tech-stack";
/* oxlint-enable import/max-dependencies */
import { UseCases } from "@/components/use-cases";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { siteConfig, siteLinks } from "@/lib/site-config";
/* oxlint-enable sort-imports */

const metadata: Metadata = {
  alternates: {
    canonical: siteLinks.home,
  },
  description:
    "Stop rebuilding the same AI chat infrastructure. ChatJS gives you a production-ready foundation with auth, streaming, tool calling, and 120+ models.",
  openGraph: {
    description:
      "A production-ready foundation with auth, streaming, tool calling, and 120+ models. Scaffold it, customize it, ship it.",
    title: "ChatJS - Stop Rebuilding the Same AI Chat Infrastructure",
    url: siteLinks.home,
  },
  title: "The Prod-Ready AI Chat App",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      codeRepository: siteLinks.github,
      description: siteConfig.description,
      image: `${siteConfig.url}${siteConfig.ogImage}`,
      name: siteConfig.name,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      operatingSystem: "Web, macOS, Windows, Linux",
      screenshot: `${siteConfig.url}${siteConfig.ogImage}`,
      softwareHelp: siteLinks.docs,
      url: siteLinks.home,
    },
    {
      "@type": "Organization",
      logo: `${siteConfig.url}/logo.svg`,
      name: siteConfig.name,
      sameAs: [siteLinks.github],
      url: siteLinks.home,
    },
    {
      "@type": "WebSite",
      description: siteConfig.description,
      name: siteConfig.name,
      url: siteLinks.home,
    },
  ],
};

const HomePage = (): React.JSX.Element => (
  <div className="flex min-h-screen flex-col">
    <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    <Navbar />
    <main className="flex-1">
      <Hero />
      <LogoCloud />
      <Features />
      <TechStack />
      <Platforms />
      <UseCases />
      <Faq />
      <GetStarted />
    </main>
    <Footer />
  </div>
);

/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default HomePage;
/* oxlint-enable import/no-default-export */
