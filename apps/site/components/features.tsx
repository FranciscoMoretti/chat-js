import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  Code,
  Columns,
  FileText,
  GitBranch,
  Globe,
  Image,
  Lightbulb,
  Lock,
  Puzzle,
  Search,
  Video,
} from "lucide-react";

interface Feature {
  description: string;
  icon: LucideIcon;
  title: string;
}

/* ── Platform ─────────────────────────────────────────────────────── */
const PLATFORM_FEATURES: Feature[] = [
  {
    icon: BrainCircuit,
    title: "120+ Models",
    description:
      "Claude, GPT, Gemini, Grok, Llama — one unified interface. Switch providers mid-conversation without losing context.",
  },
  {
    icon: FileText,
    title: "Canvas",
    description:
      "Create and edit rich documents, code files, and spreadsheets with version history, inline diffs, and real-time collaboration.",
  },
  {
    icon: Columns,
    title: "Parallel Responses",
    description:
      "Send one message to multiple models at once. Compare quality, tone, and accuracy across providers side-by-side.",
  },
  {
    icon: Lock,
    title: "Authentication",
    description:
      "Built-in OAuth with Google, GitHub, and Vercel. Session management, anonymous mode, and rate limiting.",
  },
  {
    icon: Puzzle,
    title: "MCP Support",
    description:
      "Extend capabilities with external tools and services via the Model Context Protocol.",
  },
  {
    icon: GitBranch,
    title: "Branching",
    description:
      "Fork any conversation to explore different directions without losing context.",
  },
];

/* ── Built-in Tools ───────────────────────────────────────────────── */
const TOOLS: Feature[] = [
  {
    icon: Search,
    title: "Deep Research",
    description:
      "Multi-step research agent that synthesizes the web into comprehensive reports.",
  },
  {
    icon: Lightbulb,
    title: "Reasoning",
    description:
      "Models that support reasoning can think before answering. Collapsible thinking sections and automatic model splitting.",
  },
  {
    icon: Code,
    title: "Code Execution",
    description:
      "Python and JavaScript in a secure sandbox, with pandas, numpy, matplotlib, and more pre-installed for Python.",
  },
  {
    icon: Globe,
    title: "Web Search",
    description:
      "Real-time search with inline citations grounding every conversation.",
  },
  {
    icon: Image,
    title: "Image Generation",
    description: "Create and edit images with AI, inline in any conversation.",
  },
  {
    icon: Video,
    title: "Video Generation",
    description:
      "AI-powered videos with configurable aspect ratios and durations.",
  },
];

/* ── Shared card component ────────────────────────────────────────── */

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="group border-border/50 bg-card hover:border-border hover:shadow-foreground/3 relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="bg-foreground/2 pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <div className="border-border/50 bg-secondary/50 inline-flex w-fit rounded-xl border p-2.5">
          <feature.icon className="text-foreground/70 h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">
          {feature.title}
        </h3>
        <p className="text-foreground/75 mt-2 text-sm leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="text-foreground/70 font-mono text-xs tracking-[0.2em] uppercase">
        {children}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

export function Features() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Subtle atmosphere to differentiate from TechStack grid below */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[20%] left-[10%] h-[500px] w-[600px] -rotate-12 rounded-full bg-amber-500/[0.015] blur-[120px] dark:bg-amber-400/[0.02]" />
        <div className="absolute right-[15%] bottom-[10%] h-[400px] w-[500px] rotate-6 rounded-full bg-indigo-500/[0.012] blur-[120px] dark:bg-indigo-400/[0.018]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="font-display text-center text-3xl tracking-tight sm:text-5xl">
          Everything you need, <span className="italic">out of the box</span>
        </h2>
        <p className="text-foreground/75 mx-auto mt-6 max-w-2xl text-center text-lg">
          Production features that would take months to build, ready in minutes.
        </p>

        {/* ── Platform: 3×2 uniform grid ───────────────────────── */}
        <div className="mt-20">
          <SectionLabel>Platform</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_FEATURES.map((f) => (
              <FeatureCard feature={f} key={f.title} />
            ))}
          </div>
        </div>

        {/* ── Built-in Tools: 3×2 uniform grid ─────────────────── */}
        <div className="mt-16">
          <SectionLabel>Built-in Tools</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((f) => (
              <FeatureCard feature={f} key={f.title} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
