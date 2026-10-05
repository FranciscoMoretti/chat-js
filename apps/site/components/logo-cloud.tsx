import React from "react";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "xAI", "Meta"];
/* oxlint-disable react/jsx-no-literals -- LogoCloud renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */

/* oxlint-disable react/jsx-max-depth -- LogoCloud: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
export const LogoCloud = (): React.JSX.Element => (
  <section className="border-border/30 border-y py-12">
    <div className="mx-auto max-w-6xl px-6">
      <p className="text-foreground/75 text-center text-sm tracking-wide uppercase">
        Access 120+ models from leading AI providers
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-14 gap-y-4">
        {PROVIDERS.map((name) => (
          <span
            className="text-foreground/75 hover:text-foreground text-xl font-medium tracking-tight transition-colors"
            key={name}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  </section>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */
