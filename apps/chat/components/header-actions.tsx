"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { memo } from "react";

import { DocsLink } from "@/components/docs-link";
import { GitHubLink } from "@/components/github-link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/providers/session-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type -- PureHeaderActions: oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including session?.user); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const PureHeaderActions = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {!user && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 px-3"
              onClick={() => {
                router.push("/login");
                router.refresh();
              }}
              size="sm"
              variant="outline"
            >
              <LogIn className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign in to your account</TooltipContent>
        </Tooltip>
      )}
      <DocsLink />
      <GitHubLink />
    </div>
  );
};
/* oxlint-enable oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type */
/* oxlint-disable import/no-named-export, import/prefer-default-export -- HeaderActions: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export const HeaderActions = memo(PureHeaderActions);
/* oxlint-enable import/no-named-export, import/prefer-default-export */
