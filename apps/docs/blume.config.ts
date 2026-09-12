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
  "registry",
  "tools",
  "storage",
] as const;

export default defineConfig({
  ai: {
    // Publish monorepo agent skills at /.well-known/agent-skills/
    skills: "../../.agents/skills",
    // WebMCP in-page tools (search_docs / get_page / list_pages) — on by default
    webmcp: true,
  },
  content: {
    include: [
      "*.mdx",
      ...contentSections.map((section) => `${section}/**/*.mdx`),
    ],
    root: ".",
  },
  dateFormat: { dateStyle: "medium" },
  deployment: {
    base: "/docs",
    site: "https://chatjs.dev",
  },
  description:
    "Complete documentation for ChatJS, the production-ready AI chat app. Learn authentication, streaming, tool calling, multi-model support, and deployment best practices.",
  github: {
    dir: "apps/docs",
    owner: "FranciscoMoretti",
    repo: "chat-js",
  },
  lastModified: true,
  logo: {
    image: {
      alt: "ChatJS",
      dark: "/logo/dark.svg",
      light: "/logo/light.svg",
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
        "/threads",
        {
          label: "Core Concepts",
          items: [
            "/core/architecture",
            "/core/configuration",
            "/core/authentication",
            "/core/multi-model",
            "/core/syntax-highlighting",
          ],
        },
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
        {
          label: "Tools",
          items: [
            "/tools/overview",
            "/tools/install",
            "/tools/word-count",
            "/tools/get-weather",
            "/tools/retrieve-url",
            "/tools/authoring",
          ],
        },
        {
          label: "File Storage",
          items: ["/storage", "/storage/custom"],
        },
        {
          label: "Registry",
          items: [
            "/registry",
            "/registry/namespaces",
            "/registry/authoring",
            "/registry/testing",
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
            "/reference/redis",
            "/reference/routing",
            "/reference/testing",
            "/reference/evaluations",
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
  redirects: [
    { from: "/core/use-thread", to: "/threads" },
    { from: "/core/file-storage", to: "/storage" },
    { from: "/core/registry", to: "/registry" },
    { from: "/core/tool-registry", to: "/tools/overview" },
    { from: "/cookbook/add-tools", to: "/tools/install" },
    { from: "/cookbook/tools", to: "/tools/authoring" },
  ],
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
  seo: {
    og: {
      description:
        "Production-ready AI chat documentation for auth, streaming, tools, and deployment.",
      site: "ChatJS",
    },
    x: {
      creator: "@franmoretti_",
      handle: "@franmoretti_",
    },
  },
  theme: {
    accent: { dark: "#fafafa", light: "#171717" },
    background: { dark: "#0a0a0a", light: "#ffffff" },
    radius: "md",
  },
  title: "ChatJS Documentation",
});
