import { LogIn } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DevLoginTool() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <a
      className={cn(
        buttonVariants({ size: "sm" }),
        "group fixed bottom-5 left-16 z-50 h-9 rounded-full border border-white/10 bg-black/80 px-2.5 text-xs text-zinc-300 shadow-lg shadow-black/30 backdrop-blur-md hover:border-white/15 hover:bg-zinc-900 hover:text-white"
      )}
      href="/api/dev-login"
    >
      <span aria-hidden="true" className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:animate-none" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      <LogIn className="size-3.5 text-zinc-500 transition-colors group-hover:text-zinc-300" />
      <span>Dev login</span>
    </a>
  );
}
