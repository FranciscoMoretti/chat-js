export const siteConfig = {
  name: "ChatJS",
  shortName: "ChatJS",
  title: "ChatJS",
  description:
    "Open-source Next.js AI chat app starter with authentication, streaming, tool calling, and 120+ model integrations for production deployments.",
  url: "https://chatjs.dev",
  ogImage: "/chatjs_preview_light.png",
  creator: "@franmoretti_",
  githubUrl: "https://github.com/franciscomoretti/chat-js",
  desktopUrl: "https://github.com/franciscomoretti/chat-js/releases/latest",
  demoUrl: "https://demo.chatjs.dev",
  docsUrl: "https://chatjs.dev/docs",
  keywords: [
    "AI chat app starter",
    "Next.js AI chat template",
    "open source AI chat app",
    "Vercel AI SDK starter",
    "production-ready AI chat",
    "chatbot starter kit",
    "LLM app boilerplate",
  ],
} as const;

export const siteLinks = {
  home: siteConfig.url,
  threads: `${siteConfig.url}/threads`,
  docs: siteConfig.docsUrl,
  docsGettingStarted: `${siteConfig.docsUrl}/quickstart`,
  desktop: siteConfig.desktopUrl,
  docsDesktop: `${siteConfig.docsUrl}/platforms/desktop`,
  docsDesktopMac: `${siteConfig.docsUrl}/platforms/desktop#macos`,
  docsDesktopWindows: `${siteConfig.docsUrl}/platforms/desktop#windows`,
  docsDesktopLinux: `${siteConfig.docsUrl}/platforms/desktop#linux`,
  demo: siteConfig.demoUrl,
  github: siteConfig.githubUrl,
  sitemap: `${siteConfig.url}/sitemap.xml`,
  docsSitemap: `${siteConfig.docsUrl}/sitemap.xml`,
} as const;

export const siteLastModified = new Date("2025-03-28T16:14:00.000Z");
