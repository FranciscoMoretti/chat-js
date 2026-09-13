import { siteLinks } from "@/lib/site-config";

const USE_CASES = [
  {
    description:
      "Start from a working Next.js AI chat app starter instead of wiring authentication, model routing, and streaming from scratch.",
    number: "01",
    title: "Ship an AI chat MVP fast",
  },
  {
    description:
      "Compare OpenAI, Anthropic, Google, xAI, and open models behind one interface without rebuilding your app shell.",
    number: "02",
    title: "Prototype across multiple model providers",
  },
  {
    description:
      "Keep the same codebase as you add auth, observability, tool calling, document workflows, and deployment polish.",
    number: "03",
    title: "Move from side project to production",
  },
];

export const UseCases = () => (
  <section
    aria-labelledby="use-cases-heading"
    className="relative overflow-hidden py-24 sm:py-32"
  >
    {/* Warm atmospheric bg to distinguish from FAQ below */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute top-0 left-1/3 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-amber-500/[0.02] blur-[120px] dark:bg-amber-400/[0.025]" />
      <div className="absolute right-[10%] bottom-[10%] h-[400px] w-[500px] rounded-full bg-indigo-500/[0.015] blur-[100px] dark:bg-indigo-400/[0.02]" />
    </div>
    <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="text-foreground/70 font-mono text-xs tracking-[0.25em] uppercase">
          Why developers use ChatJS
        </p>
        <h2
          className="font-display mt-4 text-3xl tracking-tight sm:text-5xl"
          id="use-cases-heading"
        >
          A practical starting point for shipping AI chat products
        </h2>
        <p className="text-foreground/75 mt-6 max-w-xl text-lg leading-relaxed">
          ChatJS gives you a credible baseline for building AI chat apps fast:
          real product infrastructure, flexible model support, and room to grow
          beyond a demo.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            className="group border-border bg-card hover:border-foreground/20 hover:text-foreground inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-300"
            href={siteLinks.docsGettingStarted}
          >
            See the setup guide
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </a>
          <a
            className="border-border bg-card hover:border-foreground/20 hover:text-foreground inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-300"
            href={siteLinks.docs}
          >
            Explore documentation
          </a>
        </div>
      </div>

      <div className="grid gap-4">
        {USE_CASES.map((item, index) => (
          <article
            className="use-case-card group border-border/50 bg-card hover:border-border/80 relative overflow-hidden rounded-2xl border p-6 transition-all duration-400 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
            key={item.title}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Top-left gradient glow on hover */}
            <div
              aria-hidden="true"
              className="from-foreground/3 pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br via-transparent to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100"
            />

            <div className="relative flex items-start gap-4">
              <span className="text-foreground/75 group-hover:text-foreground mt-1 shrink-0 font-mono text-[10px] transition-colors duration-400">
                {item.number}
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-foreground/75 mt-3 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
