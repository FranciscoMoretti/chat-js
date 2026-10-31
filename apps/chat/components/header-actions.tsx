"use client";

import { Hint } from "@/components/hint";
import { memo } from "react";
import { Button } from "@/components/ui/button";

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
        <Hint
          trigger={
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
        >
          Sign in to your account
        </Hint>
      )}
      <DocsLink />
      <GitHubLink />
    </div>
  );
};

export const HeaderActions = memo(PureHeaderActions);
