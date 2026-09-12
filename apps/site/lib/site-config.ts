export const siteConfig = {
  creator: "@franmoretti_",
  demoUrl: "https://demo.chatjs.dev",
  description:
    "Open-source Next.js AI chat app starter with authentication, streaming, tool calling, and 120+ model integrations for production deployments.",
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
  ogImage: "/chatjs_preview_light.png",
  shortName: "ChatJS",
  title: "ChatJS",
  url: "https://chatjs.dev",
} as const;

export const siteLinks = {
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

export const siteLastModified = new Date("2025-03-28T16:14:00.000Z");
