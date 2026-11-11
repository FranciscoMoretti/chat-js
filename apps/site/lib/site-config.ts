const siteConfig = {
  appScreenshot: "/chatjs_preview_light.png",
  creator: "@franmoretti_",
  demoUrl: "https://demo.chatjs.dev",
  description:
    "The building blocks for your AI app. A working chat, your choice of models, tools and plugins. Code you own.",
  desktopUrl: "https://github.com/franciscomoretti/chat-js/releases/latest",
  docsUrl: "https://chatjs.dev/docs",
  githubUrl: "https://github.com/franciscomoretti/chat-js",
  keywords: [
    "AI chat app starter",
    "Next.js AI chat template",
    "open source AI chat app",
    "Vercel AI SDK starter",
    "production-ready AI chat",
    "chatbot starter kit",
    "LLM app boilerplate",
  ],
  name: "ChatJS",
  ogImage: "/opengraph-image.jpg",
  shortName: "ChatJS",
  title: "ChatJS",
  url: "https://chatjs.dev",
} as const;

const siteLinks = {
  demo: siteConfig.demoUrl,
  desktop: siteConfig.desktopUrl,
  docs: siteConfig.docsUrl,
  docsDesktop: `${siteConfig.docsUrl}/platforms/desktop`,
  docsDesktopLinux: `${siteConfig.docsUrl}/platforms/desktop#linux`,
  docsDesktopMac: `${siteConfig.docsUrl}/platforms/desktop#macos`,
  docsDesktopWindows: `${siteConfig.docsUrl}/platforms/desktop#windows`,
  docsGettingStarted: `${siteConfig.docsUrl}/quickstart`,
  docsSitemap: `${siteConfig.docsUrl}/sitemap.xml`,
  github: siteConfig.githubUrl,
  home: siteConfig.url,
  sitemap: `${siteConfig.url}/sitemap.xml`,
  threads: `${siteConfig.url}/threads`,
} as const;

const docsNavigationHref =
  process.env.NODE_ENV === "development"
    ? (process.env.NEXT_PUBLIC_CHATJS_DOCS_URL ?? siteLinks.docs)
    : siteLinks.docs;

const siteLastModified = new Date("2025-03-28T16:14:00.000Z");
export { docsNavigationHref, siteConfig, siteLastModified, siteLinks };
