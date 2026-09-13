import type { Metadata } from "next";

import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { LogoCloud } from "@/components/logo-cloud";
import { Navbar } from "@/components/navbar";
import { Platforms } from "@/components/platforms";
import { TechStack } from "@/components/tech-stack";
import { UseCases } from "@/components/use-cases";
import { siteConfig, siteLinks } from "@/lib/site-config";

export const metadata: Metadata = {
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

const HomePage = () => (
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

export default HomePage;
