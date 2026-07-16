import { defineConfig } from "blume";

const contentSections = [
  "cli",
  "cookbook",
  "core",
  "customization",
  "deployment",
  "features",
  "gateways",
  "platforms",
  "reference",
] as const;

export default defineConfig({
  title: "ChatJS Documentation",
  description:
    "Complete documentation for ChatJS, the production-ready AI chat app. Learn authentication, streaming, tool calling, multi-model support, and deployment best practices.",
  content: {
    root: ".",
    include: [
      "*.mdx",
      ...contentSections.map((section) => `${section}/**/*.mdx`),
    ],
  },
  deployment: {
    base: "/docs",
    site: "https://chatjs.dev",
  },
  github: {
    owner: "FranciscoMoretti",
    repo: "chat-js",
    dir: "apps/docs",
  },
  seo: {
    x: {
      creator: "@franmoretti_",
      handle: "@franmoretti_",
    },
  },
  logo: {
    image: {
      alt: "ChatJS",
      light: "/logo/light.svg",
      dark: "/logo/dark.svg",
    },
    text: "",
  },
  navigation: {
    featured: [
      {
        label: "Demo",
        href: "https://demo.chatjs.dev",
        icon: "sparkles",
      },
      {
        label: "X",
        href: "https://x.com/franmoretti_",
      },
    ],
    sidebar: {
      display: "flat",
      items: [
        "/",
        "/quickstart",
        "/changelog",
        {
          label: "Core Concepts",
          items: [
            "/core/architecture",
            "/core/configuration",
            "/core/use-thread",
            "/core/file-storage",
            "/core/authentication",
            "/core/tool-registry",
            "/core/multi-model",
            "/core/syntax-highlighting",
          ],
        },
        {
          label: "Features",
          items: [
            "/features/overview",
            "/features/web-search",
            "/features/url-retrieval",
            "/features/deep-research",
            "/features/code-execution",
            "/features/image-generation",
            "/features/video-generation",
            "/features/attachments",
            "/features/mcp",
            "/features/canvas",
            "/features/reasoning",
            "/features/sharing",
            "/features/branching",
            "/features/parallel-responses",
            "/features/projects",
            "/features/follow-up-suggestions",
          ],
        },
        {
          label: "Customization",
          items: [
            "/customization/theming",
            "/customization/fonts",
            "/customization/branding",
            "/customization/models",
            "/customization/prompts",
          ],
        },
        {
          label: "Deployment",
          items: [
            "/deployment/vercel",
            "/deployment/docker",
            "/deployment/self-hosted",
          ],
        },
        {
          label: "Platforms",
          items: ["/platforms/web", "/platforms/desktop"],
        },
        {
          label: "CLI",
          items: ["/cli", "/cli/create", "/cli/add", "/cli/config"],
        },
        {
          label: "Reference",
          items: [
            "/project-structure",
            "/reference/cli",
            "/reference/config",
            "/reference/env-vars",
            "/reference/database",
            "/reference/routing",
            "/reference/testing",
            "/reference/evaluations",
            {
              label: "Gateways",
              items: [
                "/gateways/overview",
                "/gateways/vercel",
                "/gateways/openrouter",
                "/gateways/openai",
                "/gateways/openai-compatible",
                "/gateways/litellm",
                "/gateways/custom",
              ],
            },
          ],
        },
        {
          label: "Cookbook",
          root: "/cookbook",
          items: [
            "/cookbook",
            "/cookbook/resumable-streams",
            "/cookbook/stop-resumable-streams",
            "/cookbook/tool-part",
            "/cookbook/tools",
            "/cookbook/add-tools",
            "/cookbook/next-chat-transition",
            "/cookbook/credit-tracking",
            "/cookbook/neon-branching",
            "/cookbook/dev-auth-bypass",
            "/cookbook/follow-up-questions",
            "/cookbook/explicit-tool-selection",
            "/cookbook/chat-layout",
            "/cookbook/component-registries",
            "/cookbook/auto-updating-models",
            "/cookbook/git-worktrees",
          ],
        },
      ],
    },
    tabs: [
      { label: "Docs", path: "/" },
      { label: "Cookbook", path: "/cookbook" },
    ],
  },
  theme: {
    accent: { light: "#171717", dark: "#fafafa" },
    background: { light: "#ffffff", dark: "#0a0a0a" },
    radius: "md",
  },
});
