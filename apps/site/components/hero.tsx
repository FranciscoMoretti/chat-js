import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { siteLinks } from "@/lib/site-config";

const Sparkle = ({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8Z" />
  </svg>
);

export const Hero = () => (
  <section className="relative overflow-hidden">
    {/* Background atmosphere — layered organic gradients */}
    <div className="pointer-events-none absolute inset-0">
      {/* Top fade from card into bg */}
      <div className="from-card/40 absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b via-transparent to-transparent" />
      {/* Warm accent blob — left */}
      <div className="absolute top-[25%] left-[15%] h-[500px] w-[600px] -rotate-12 rounded-full bg-amber-500/2.5 blur-[120px] dark:bg-amber-400/3" />
      {/* Cool accent blob — right */}
      <div className="absolute top-[35%] right-[10%] h-[450px] w-[550px] rotate-12 rounded-full bg-indigo-500/2 blur-[120px] dark:bg-indigo-400/2.5" />
      {/* Center glow behind mockup */}
      <div className="bg-foreground/2 absolute bottom-[5%] left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full blur-[120px]" />
    </div>

    {/* Decorative sparkles */}
    <Sparkle
      className="animate-sparkle text-foreground/7 pointer-events-none absolute top-32 left-[12%] hidden sm:block"
      size={20}
    />
    <Sparkle
      className="animate-sparkle text-foreground/5 pointer-events-none absolute top-48 right-[18%] hidden sm:block"
      size={14}
    />
    <Sparkle
      className="animate-sparkle text-foreground/6 pointer-events-none absolute bottom-[30%] left-[8%] hidden lg:block"
      size={10}
    />
    <Sparkle
      className="animate-sparkle text-foreground/4 pointer-events-none absolute top-[60%] right-[8%] hidden lg:block"
      size={16}
    />

    <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-20 sm:pt-28 sm:pb-28">
      {/* Badge */}
      <div className="animate-fade-in-up flex justify-center">
        <a
          className="border-border/60 bg-card/70 text-foreground/75 hover:border-foreground/20 hover:text-foreground inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm backdrop-blur-sm transition-colors"
          href="https://github.com/franciscomoretti/chat-js"
          rel="noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <title>GitHub</title>
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Open Source — Apache 2.0
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Headline */}
      <h1
        className="animate-fade-in-up font-display text-foreground mx-auto mt-8 max-w-4xl text-center text-5xl tracking-tight sm:text-7xl lg:text-8xl"
        style={{ animationDelay: "0.1s" }}
      >
        Ship AI chat in <span className="italic">minutes</span>, not months
      </h1>

      {/* Subhead */}
      <p
        className="animate-fade-in-up text-foreground/75 mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed sm:text-xl"
        style={{ animationDelay: "0.2s" }}
      >
        An open-source, production-ready AI chat foundation. Authentication,
        120+ models, streaming, tool calling — everything you need to launch.
      </p>

      {/* CTA */}
      <div
        className="animate-fade-in-up mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center"
        style={{ animationDelay: "0.3s" }}
      >
        <a
          className="bg-primary text-primary-foreground shadow-primary/15 hover:shadow-primary/20 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-medium shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          href={siteLinks.docsGettingStarted}
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          className="border-foreground/15 text-foreground/70 hover:border-foreground/25 hover:text-foreground/90 inline-flex items-center gap-2 rounded-xl border px-8 py-3.5 text-sm font-medium transition-all hover:-translate-y-0.5"
          href={siteLinks.demo}
        >
          Live Demo
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Chat Preview */}
      <div
        className="animate-fade-in-up relative mx-auto mt-20 max-w-3xl perspective-distant"
        style={{ animationDelay: "0.5s" }}
      >
        {/* Layered ambient glow */}
        <div className="bg-foreground/[0.07] pointer-events-none absolute -inset-8 rounded-3xl blur-3xl" />
        <div className="bg-foreground/4 pointer-events-none absolute -inset-16 rounded-4xl blur-[80px]" />

        {/* Screenshot with depth */}
        <div className="animate-float ring-foreground/[0.08] relative [transform:rotateX(2deg)] rounded-2xl shadow-[0_20px_70px_-10px_rgba(0,0,0,0.35)] ring-1 transition-transform duration-700 hover:[transform:rotateX(0deg)] dark:shadow-[0_20px_70px_-10px_rgba(0,0,0,0.7)]">
          <div className="overflow-hidden rounded-2xl">
            <Image
              alt="ChatJS — AI chat interface"
              className="block h-auto w-full dark:hidden"
              fetchPriority="high"
              height={1536}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1024px"
              src="/chatjs_preview_light.png"
              width={2048}
            />
            <Image
              alt="ChatJS — AI chat interface"
              className="hidden h-auto w-full dark:block"
              height={1536}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1024px"
              src="/chatjs_preview_dark.png"
              width={2048}
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);
