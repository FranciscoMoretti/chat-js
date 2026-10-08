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
import type { LucideProps } from "lucide-react";
import React from "react";

type FeatureIcon = (
  props: Readonly<Pick<LucideProps, "className">>
) => React.ReactNode;

interface Feature {
  readonly description: string;
  readonly icon: FeatureIcon;
  readonly title: string;
}

/* ── Platform ─────────────────────────────────────────────────────── */
const PLATFORM_FEATURES: readonly Feature[] = [
  {
    description:
      "Claude, GPT, Gemini, Grok, Llama — one unified interface. Switch providers mid-conversation without losing context.",
    icon: BrainCircuit,
    title: "120+ Models",
  },
  {
    description:
      "Create and edit rich documents, code files, and spreadsheets with version history, inline diffs, and real-time collaboration.",
    icon: FileText,
    title: "Canvas",
  },
  {
    description:
      "Send one message to multiple models at once. Compare quality, tone, and accuracy across providers side-by-side.",
    icon: Columns,
    title: "Parallel Responses",
  },
  {
    description:
      "Built-in OAuth with Google, GitHub, and Vercel. Session management, anonymous mode, and rate limiting.",
    icon: Lock,
    title: "Authentication",
  },
  {
    description:
      "Extend capabilities with external tools and services via the Model Context Protocol.",
    icon: Puzzle,
    title: "MCP Support",
  },
  {
    description:
      "Fork any conversation to explore different directions without losing context.",
    icon: GitBranch,
    title: "Branching",
  },
];

/* ── Built-in Tools ───────────────────────────────────────────────── */
const TOOLS: readonly Feature[] = [
  {
    description:
      "Multi-step research agent that synthesizes the web into comprehensive reports.",
    icon: Search,
    title: "Deep Research",
  },
  {
    description:
      "Models that support reasoning can think before answering. Collapsible thinking sections and automatic model splitting.",
    icon: Lightbulb,
    title: "Reasoning",
  },
  {
    description:
      "Python and JavaScript in a secure sandbox, with pandas, numpy, matplotlib, and more pre-installed for Python.",
    icon: Code,
    title: "Code Execution",
  },
  {
    description:
      "Real-time search with inline citations grounding every conversation.",
    icon: Globe,
    title: "Web Search",
  },
  {
    description: "Create and edit images with AI, inline in any conversation.",
    icon: Image,
    title: "Image Generation",
  },
  {
    description:
      "AI-powered videos with configurable aspect ratios and durations.",
    icon: Video,
    title: "Video Generation",
  },
];

/* oxlint-disable react/jsx-max-depth -- FeatureCard: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
/* ── Shared card component ────────────────────────────────────────── */

const FeatureCard = ({
  feature,
}: {
  readonly feature: Feature;
}): React.JSX.Element => (
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
/* oxlint-enable react/jsx-max-depth */

/* oxlint-disable react/no-multi-comp -- SectionLabel: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
const SectionLabel = ({
  children,
}: {
  readonly children: string;
}): React.JSX.Element => (
  <div className="mb-8 flex items-center gap-4">
    <span className="text-foreground/70 font-mono text-xs tracking-[0.2em] uppercase">
      {children}
    </span>
    <div className="bg-border h-px flex-1" />
  </div>
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Features); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- Features renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- Features: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */

/* oxlint-disable react/jsx-max-depth -- Features: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
/* ── Main component ───────────────────────────────────────────────── */

export const Features = (): React.JSX.Element => (
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
          {PLATFORM_FEATURES.map((feature) => (
            <FeatureCard feature={feature} key={feature.title} />
          ))}
        </div>
      </div>

      {/* ── Built-in Tools: 3×2 uniform grid ─────────────────── */}
      <div className="mt-16">
        <SectionLabel>Built-in Tools</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((feature) => (
            <FeatureCard feature={feature} key={feature.title} />
          ))}
        </div>
      </div>
    </div>
  </section>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable react/no-multi-comp */
