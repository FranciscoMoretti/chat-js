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
  lastModified: true,
  dateFormat: { dateStyle: "medium" },
  seo: {
    x: {
      creator: "@franmoretti_",
      handle: "@franmoretti_",
    },
    og: {
      site: "chatjs.dev/docs",
      description:
        "Production-ready AI chat documentation for auth, streaming, tools, and deployment.",
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
  ai: {
    // Publish monorepo agent skills at /.well-known/agent-skills/
    skills: "../../.agents/skills",
    // WebMCP in-page tools (search_docs / get_page / list_pages) — on by default
    webmcp: true,
  },
  search: {
    popular: [
      { href: "/quickstart", label: "Quickstart", icon: "rocket" },
      { href: "/core/configuration", label: "Configuration", icon: "settings" },
      { href: "/features/overview", label: "Features", icon: "sparkles" },
      { href: "/deployment/vercel", label: "Deploy to Vercel", icon: "cloud" },
      { href: "/cookbook", label: "Cookbook", icon: "book-open" },
      { href: "/cli", label: "CLI", icon: "terminal" },
    ],
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
      // href keeps the tab on the declared route (1.2) instead of falling back
      // to the section's first content page when path isn't a standalone page.
      { label: "Docs", path: "/", href: "/" },
      { label: "Cookbook", path: "/cookbook", href: "/cookbook" },
    ],
  },
  theme: {
    accent: { light: "#171717", dark: "#fafafa" },
    background: { light: "#ffffff", dark: "#0a0a0a" },
    radius: "md",
  },
});
