import { Minus, PlugZap, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./setup-provider-mark.module.css";
import { CapabilityVisual } from "./capability-visual";

const providerBrands: Readonly<Record<string, string>> = {
  "vercel-blob": "vercel",
  desktop: "electron",
  r2: "cloudflare",
  s3: "aws-s3",
};

export const SetupProviderMark = ({ id }: { readonly id: string }) => {
  const symbols: Readonly<Record<string, LucideIcon>> = {
    none: Minus,
    "openai-compatible": PlugZap,
    litellm: Route,
  };
  const Symbol = symbols[id];
  if (Symbol !== undefined) {
    return (
      <span
        aria-hidden="true"
        className="text-muted-foreground flex size-9 items-center justify-center"
      >
        <Symbol className="size-8" strokeWidth={1.5} />
      </span>
    );
  }
  const brand = providerBrands[id] ?? id;
  const monochrome = brand === "vercel" || brand === "openai";
  return (
    <span className={`${styles.mark} ${monochrome ? styles.monochrome : ""}`}>
      <CapabilityVisual id={`setup/${brand}`} />
    </span>
  );
};
