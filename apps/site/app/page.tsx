import { siteConfig, siteLinks } from "@/lib/site-config";
import { Homepage } from "@/components/home/homepage";
import { colors } from "@chatjs/brand/identity";
import type { Metadata, Viewport } from "next";
import React from "react";

const socialDescription =
  "A working chat. Your choice of models. Tools and plugins. Code you own.";
const socialTitle = "ChatJS — The building blocks for your AI app";
const viewport: Viewport = { themeColor: colors.background };

const metadata: Metadata = {
  alternates: {
    canonical: siteLinks.home,
  },
  description:
    "The building blocks for your AI app. A working chat, your choice of models, tools and plugins. Code you own.",
  openGraph: {
    description: socialDescription,
    title: socialTitle,
    url: siteLinks.home,
  },
  title: "The building blocks for your AI app",
  twitter: {
    card: "summary_large_image",
    creator: siteConfig.creator,
    description: socialDescription,
    images: [siteConfig.ogImage],
    title: socialTitle,
  },
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
      screenshot: `${siteConfig.url}${siteConfig.appScreenshot}`,
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
  <>
    <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    <Homepage />
  </>
);

export { metadata, viewport };
export default HomePage;
