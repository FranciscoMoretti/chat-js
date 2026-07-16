import {
  ArrowRight,
  Braces,
  Check,
  CircleStop,
  GitBranch,
  GitFork,
  Layers3,
  Radio,
  RefreshCw,
  Route,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import {
  ThreadInstallCommand,
  ThreadPlayground,
} from "@/components/thread-registry-showcase";
import { siteLinks } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "useThread — Branching Chats for AI SDK",
  description:
    "Keep the useChat interface and add message trees, branch navigation, and concurrent AI SDK response streams.",
  alternates: {
    canonical: siteLinks.threads,
  },
  openGraph: {
    url: siteLinks.threads,
    title: "useThread — Branching Chats for AI SDK",
    description:
      "A useChat-compatible active path backed by a complete message tree.",
  },
};

const compatibility = [
  "messages",
  "sendMessage",
  "setMessages",
  "regenerate",
  "stop",
  "status + error",
  "tools + approvals",
  "ChatTransport",
] as const;

const additions = [
  {
    icon: Route,
    title: "Cursor navigation",
    description:
      "Select any message and expose its root-to-node path as chat.messages.",
  },
  {
    icon: GitFork,
    title: "Message topology",
    description:
      "Read parents, children, siblings, leaves, and complete tree snapshots.",
  },
  {
    icon: Radio,
    title: "Independent runs",
    description:
      "Stream, stop, and resume responses without coupling them to the visible path.",
  },
  {
    icon: Layers3,
    title: "Parallel responses",
    description:
      "Start multiple assistant runs from one user message and follow only the one you choose.",
  },
] as const;

const architectureRows = [
  {
    label: "Tree",
    detail: "Canonical messages, parent-child edges, and the selected cursor.",
  },
  {
    label: "Active path",
    detail: "A useChat-compatible projection from the root to the cursor.",
  },
  {
    label: "Branch runs",
    detail:
      "One isolated AI SDK request lifecycle and abort controller per response.",
  },
  {
    label: "Transport",
    detail:
      "Your existing AI SDK ChatTransport, shared without a new wire protocol.",
  },
] as const;

export default function ThreadsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="border-border/50 border-b">
          <div className="mx-auto max-w-6xl px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(23rem,0.88fr)] lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  <GitBranch className="size-4" />
                  useThread for AI SDK
                </div>
                <h1 className="mt-7 max-w-4xl font-display text-4xl leading-[0.98] tracking-tight sm:text-7xl">
                  Branching conversations for AI SDK.
                </h1>
                <p className="mt-7 max-w-2xl text-foreground/72 text-lg leading-8 sm:text-xl">
                  Keep the{" "}
                  <code className="font-mono text-[0.9em] text-foreground">
                    useChat
                  </code>{" "}
                  interface. Add a complete message tree, branch navigation, and
                  concurrent responses that keep streaming when users move
                  elsewhere.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <a
                    className="inline-flex min-h-11 items-center gap-2 bg-primary px-5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-85"
                    href="#playground"
                  >
                    Try the playground
                    <ArrowRight className="size-4" />
                  </a>
                  <a
                    className="inline-flex min-h-11 items-center gap-2 border-border border-b text-foreground/75 text-sm transition-colors hover:text-foreground"
                    href={`${siteLinks.github}/tree/main/packages/thread`}
                  >
                    Read the package
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>

              <div className="min-w-0 border-border border-y bg-card">
                <div className="flex items-center justify-between border-border border-b px-4 py-3">
                  <span className="font-mono text-muted-foreground text-xs">
                    Chat.tsx
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase">
                    <Check className="size-3" /> useChat compatible
                  </span>
                </div>
                <pre className="overflow-x-auto px-4 py-5 font-mono text-[13px] leading-7">
                  <code>
                    <span className="text-muted-foreground">- </span>
                    <span className="text-foreground/55">
                      import {"{ useChat }"} from &quot;@ai-sdk/react&quot;;
                    </span>
                    {"\n"}
                    <span className="text-foreground">
                      + import {"{ useThread }"} from
                      &quot;@chatjs/thread/react&quot;;
                    </span>
                    {"\n\n"}
                    <span className="text-muted-foreground">- </span>
                    <span className="text-foreground/55">
                      const chat = useChat({"{ transport }"});
                    </span>
                    {"\n"}
                    <span className="text-foreground">
                      + const chat = useThread({"{ transport }"});
                    </span>
                    {"\n\n"}
                    <span className="text-foreground">chat.messages;</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {"// selected path"}
                    </span>
                    {"\n"}
                    <span className="text-foreground">chat.tree;</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {"// complete tree"}
                    </span>
                  </code>
                </pre>
              </div>
            </div>

            <ThreadInstallCommand />
          </div>
        </section>

        <section className="scroll-mt-20 py-16 sm:py-20" id="playground">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  The package, not a mockup
                </p>
                <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-5xl">
                  Move through the tree while it streams.
                </h2>
              </div>
              <p className="max-w-sm text-foreground/65 text-sm leading-6">
                Branch from any message, request parallel replies, switch paths
                mid-stream, and stop individual runs. The canvas reads directly
                from useThread state.
              </p>
            </div>
            <ThreadPlayground />
          </div>
        </section>

        <section className="border-border/50 border-y bg-card py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  A strict extension
                </p>
                <h2 className="mt-5 font-display text-3xl tracking-tight sm:text-5xl">
                  Your chat stays linear. Its history does not.
                </h2>
                <p className="mt-5 text-foreground/68 leading-7">
                  Existing message lists and composers keep using the selected
                  path. Tree-specific state is additive and namespaced under{" "}
                  <code className="font-mono text-foreground text-sm">
                    chat.tree
                  </code>
                  .
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 border-border border-b pb-4">
                  <Braces className="size-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Same AI SDK surface</h3>
                </div>
                <div className="grid grid-cols-2 border-border border-b sm:grid-cols-4">
                  {compatibility.map((item) => (
                    <div
                      className="flex min-h-14 items-center gap-2 border-border border-r px-3 font-mono text-xs last:border-r-0 sm:[&:nth-child(4n)]:border-r-0"
                      key={item}
                    >
                      <Check className="size-3.5 shrink-0 text-muted-foreground" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-10 grid sm:grid-cols-2">
                  {additions.map((item) => (
                    <article
                      className="border-border border-b py-6 sm:even:border-l sm:even:pl-7 sm:odd:pr-7"
                      key={item.title}
                    >
                      <item.icon className="size-4 text-muted-foreground" />
                      <h3 className="mt-4 font-medium">{item.title}</h3>
                      <p className="mt-2 text-foreground/65 text-sm leading-6">
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-20">
              <div>
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  Why it keeps working
                </p>
                <h2 className="mt-5 font-display text-3xl tracking-tight sm:text-5xl">
                  One tree. One AI SDK lifecycle per response.
                </h2>
                <p className="mt-5 max-w-xl text-foreground/68 leading-7">
                  A single linear chat engine cannot safely own several branch
                  streams. useThread isolates each response while routing every
                  update into its reserved assistant node.
                </p>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-foreground/65 text-sm">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-3.5" /> Resume per run
                  </span>
                  <span className="flex items-center gap-2">
                    <CircleStop className="size-3.5" /> Stop per run
                  </span>
                  <span className="flex items-center gap-2">
                    <Workflow className="size-3.5" /> Navigate independently
                  </span>
                </div>
              </div>

              <div className="border-border border-t">
                {architectureRows.map((row, index) => (
                  <div
                    className="grid gap-2 border-border border-b py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"
                    key={row.label}
                  >
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground">
                        0{index + 1}
                      </span>
                      {row.label}
                    </div>
                    <p className="text-foreground/68 text-sm leading-6">
                      {row.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-border/50 border-y bg-card py-20 sm:py-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.18em]">
                Headless by design
              </p>
              <h2 className="mt-5 font-display text-3xl tracking-tight sm:text-5xl">
                Own the experience. Choose how you integrate it.
              </h2>
              <p className="mt-5 text-foreground/68 leading-7">
                Install the versioned package or copy the source through the
                registry. Your conversation UI, branch controls, persistence,
                and server routes remain application-owned.
              </p>
            </div>
            <a
              className="inline-flex min-h-11 shrink-0 items-center gap-2 bg-primary px-5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-85"
              href={`${siteLinks.github}/blob/main/packages/thread/README.md`}
            >
              Read the integration guide
              <ArrowRight className="size-4" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
