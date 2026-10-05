"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX as ReactJSX } from "react";
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
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- PureHeaderActions: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const PureHeaderActions = (): ReactJSX.Element => {
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */

export const HeaderActions = memo(PureHeaderActions);
