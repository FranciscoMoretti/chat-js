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
} from "@/components/thread-showcase";
import { siteConfig, siteLinks } from "@/lib/site-config";

const THREADS_TITLE = "useThread — Branching Chats for AI SDK";
const THREADS_DESCRIPTION =
  "Keep the useChat interface and add message trees, branch navigation, and concurrent AI SDK response streams.";

export const metadata: Metadata = {
  alternates: {
    canonical: siteLinks.threads,
  },
  description: THREADS_DESCRIPTION,
  openGraph: {
    description:
      "A useChat-compatible active path backed by a complete message tree.",
    title: THREADS_TITLE,
    url: siteLinks.threads,
  },
  title: THREADS_TITLE,
  twitter: {
    card: "summary_large_image",
    creator: siteConfig.creator,
    description: THREADS_DESCRIPTION,
    images: [siteConfig.ogImage],
    title: THREADS_TITLE,
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
    description:
      "Select any message and expose its root-to-node path as chat.messages.",
    icon: Route,
    title: "Cursor navigation",
  },
  {
    description:
      "Read parents, children, siblings, leaves, and complete tree snapshots.",
    icon: GitFork,
    title: "Message topology",
  },
  {
    description:
      "Stream, stop, and resume responses without coupling them to the visible path.",
    icon: Radio,
    title: "Independent runs",
  },
  {
    description:
      "Start multiple assistant runs from one user message and follow only the one you choose.",
    icon: Layers3,
    title: "Parallel responses",
  },
] as const;

const architectureRows = [
  {
    detail: "Canonical messages, parent-child edges, and the selected cursor.",
    label: "Tree",
  },
  {
    detail: "A useChat-compatible projection from the root to the cursor.",
    label: "Active path",
  },
  {
    detail:
      "One isolated AI SDK request lifecycle and abort controller per response.",
    label: "Branch runs",
  },
  {
    detail:
      "Your existing AI SDK ChatTransport, shared without a new wire protocol.",
    label: "Transport",
  },
] as const;

const ThreadsPage = () => (
  <div className="flex min-h-screen flex-col">
    <Navbar />
    <main className="flex-1">
      <section className="border-border/50 border-b">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(23rem,0.88fr)] lg:items-end">
            <div className="min-w-0">
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.18em] uppercase">
                <GitBranch className="size-4" />
                useThread for AI SDK
              </div>
              <h1 className="font-display mt-7 max-w-4xl text-4xl leading-[0.98] tracking-tight sm:text-7xl">
                Branching conversations for AI SDK.
              </h1>
              <p className="text-foreground/72 mt-7 max-w-2xl text-lg leading-8 sm:text-xl">
                Keep the{" "}
                <code className="text-foreground font-mono text-[0.9em]">
                  useChat
                </code>{" "}
                interface. Add a complete message tree, branch navigation, and
                concurrent responses that keep streaming when users move
                elsewhere.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <a
                  className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 px-5 text-sm font-medium transition-opacity hover:opacity-85"
                  href="#playground"
                >
                  Try the playground
                  <ArrowRight className="size-4" />
                </a>
                <a
                  className="border-border text-foreground/75 hover:text-foreground inline-flex min-h-11 items-center gap-2 border-b text-sm transition-colors"
                  href={`${siteLinks.docs}/threads`}
                >
                  Read the docs
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            <div className="border-border bg-card min-w-0 border-y">
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <span className="text-muted-foreground font-mono text-xs">
                  Chat.tsx
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px] uppercase">
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
                    &quot;@chat-js/thread/react&quot;;
                  </span>
                  {"\n\n"}
                  <span className="text-muted-foreground">- </span>
                  <span className="text-foreground/55">
                    const chat = useChat();
                  </span>
                  {"\n"}
                  <span className="text-foreground">
                    + const chat = useThread();
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
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                The package, not a mockup
              </p>
              <h2 className="font-display mt-4 text-3xl tracking-tight sm:text-5xl">
                Move through the tree while it streams.
              </h2>
            </div>
            <p className="text-foreground/65 max-w-sm text-sm leading-6">
              Branch from any message, request parallel replies, switch paths
              mid-stream, and stop individual runs. The canvas reads directly
              from useThread state.
            </p>
          </div>
          <ThreadPlayground />
        </div>
      </section>

      <section className="border-border/50 bg-card border-y py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                A strict extension
              </p>
              <h2 className="font-display mt-5 text-3xl tracking-tight sm:text-5xl">
                Your chat stays linear. Its history does not.
              </h2>
              <p className="text-foreground/68 mt-5 leading-7">
                Existing message lists and composers keep using the selected
                path. Tree-specific state is additive and namespaced under{" "}
                <code className="text-foreground font-mono text-sm">
                  chat.tree
                </code>
                .
              </p>
            </div>

            <div>
              <div className="border-border flex items-center gap-2 border-b pb-4">
                <Braces className="text-muted-foreground size-4" />
                <h3 className="text-sm font-medium">Same AI SDK surface</h3>
              </div>
              <div className="border-border grid grid-cols-2 border-b sm:grid-cols-4">
                {compatibility.map((item) => (
                  <div
                    className="border-border flex min-h-14 items-center gap-2 border-r px-3 font-mono text-xs last:border-r-0 max-sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-child(4n)]:border-r-0"
                    key={item}
                  >
                    <Check className="text-muted-foreground size-3.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10 grid sm:grid-cols-2">
                {additions.map((item) => (
                  <article
                    className="border-border border-b py-6 sm:odd:pr-7 sm:even:border-l sm:even:pl-7"
                    key={item.title}
                  >
                    <item.icon className="text-muted-foreground size-4" />
                    <h3 className="mt-4 font-medium">{item.title}</h3>
                    <p className="text-foreground/65 mt-2 text-sm leading-6">
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
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                Why it keeps working
              </p>
              <h2 className="font-display mt-5 text-3xl tracking-tight sm:text-5xl">
                One tree. One AI SDK lifecycle per response.
              </h2>
              <p className="text-foreground/68 mt-5 max-w-xl leading-7">
                A single linear chat engine cannot safely own several branch
                streams. useThread isolates each response while routing every
                update into its own assistant node once streaming begins.
              </p>
              <div className="text-foreground/65 mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
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
                  className="border-border grid gap-2 border-b py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"
                  key={row.label}
                >
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-muted-foreground">0{index + 1}</span>
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

      <section className="border-border/50 bg-card border-y py-20 sm:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
              Headless by design
            </p>
            <h2 className="font-display mt-5 text-3xl tracking-tight sm:text-5xl">
              Own the experience. Choose how you integrate it.
            </h2>
            <p className="text-foreground/68 mt-5 leading-7">
              Install the versioned package alongside AI SDK. Your conversation
              UI, branch controls, persistence, and server routes remain
              application-owned.
            </p>
          </div>
          <a
            className="bg-primary text-primary-foreground inline-flex min-h-11 shrink-0 items-center gap-2 px-5 text-sm font-medium transition-opacity hover:opacity-85"
            href={`${siteLinks.docs}/threads`}
          >
            Read the docs
            <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default ThreadsPage;
