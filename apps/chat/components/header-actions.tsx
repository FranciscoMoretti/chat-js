"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { DocsLink } from "@/components/docs-link";

import { GitHubLink } from "@/components/github-link";
import { LogIn } from "lucide-react";

import type { JSX as ReactJSX } from "react";

import { useRouter } from "next/navigation";

import { useSession } from "@/providers/session-provider";

const PureHeaderActions = (): ReactJSX.Element => {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {!user && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Sign in"
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
            }
          />
          <TooltipContent>Sign in to your account</TooltipContent>
        </Tooltip>
      )}
      <DocsLink />
      <GitHubLink />
    </div>
  );
};

export const HeaderActions = memo(PureHeaderActions);
