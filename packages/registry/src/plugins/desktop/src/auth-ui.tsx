"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import type { JSX as ReactJSX } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { Session } from "@/lib/auth";

import config from "@/chat.config";

import authClient from "@/chatjs/plugins/desktop/desktop-auth-client";

import { Button, buttonVariants } from "@/components/ui/button";

import { useRouter } from "next/navigation";

const AUTH_FEEDBACK_DELAY_MS = 300;

const ElectronBrowserSignIn = ({
  buttonLabel = "Continue with browser",
}: {
  readonly buttonLabel?: string;
}): ReactJSX.Element => {
  const [opened, setOpened] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">
        Sign-in opens in your browser. On macOS, {config.appName} may ask to use
        Keychain so it can store your session securely.
      </p>
      <Button
        className="w-full"
        onClick={() => {
          const { requestAuth } = window;
          if (typeof requestAuth !== "function") {
            return;
          }
          const launchBrowserSignIn = async (): Promise<void> => {
            try {
              await Promise.resolve();
              await requestAuth();
            } catch (error) {
              console.error("Failed to launch browser sign-in", error);
            }
          };
          void launchBrowserSignIn();
          globalThis.setTimeout(() => {
            setOpened(true);
          }, AUTH_FEEDBACK_DELAY_MS);
        }}
        type="button"
        variant="outline"
      >
        <ExternalLink className="mr-2 size-4" />
        {buttonLabel}
      </Button>

      {opened ? (
        <p className="text-muted-foreground text-center text-sm">
          Finish signing in through your browser. If macOS asks about Keychain
          access, allow it to keep your session saved securely.
        </p>
      ) : null}
    </div>
  );
};

const ElectronTransferUser = ({
  query,
  session,
}: {
  readonly query: Readonly<Record<string, string>>;
  readonly session: ReadonlyNativeSurface<Session>;
}): ReactJSX.Element => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasStartedTransferRef = useRef(false);
  const useAnotherAccountHref = useMemo(() => {
    const params = new URLSearchParams(query);
    params.delete("client_id");
    params.delete("state");
    params.delete("code_challenge");
    params.delete("code_challenge_method");

    const nextQuery = params.toString();
    if (nextQuery) {
      return `/login?${nextQuery}`;
    }
    return "/login";
  }, [query]);

  useEffect(() => {
    if (hasStartedTransferRef.current) {
      return;
    }
    hasStartedTransferRef.current = true;

    startTransition(async () => {
      await authClient.electron.transferUser({ fetchOptions: { query } });
      router.refresh();
    });
  }, [query, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">{session.user.name || session.user.email}</p>
        <p className="text-muted-foreground">{session.user.email}</p>
      </div>

      <Button
        className="w-full"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await authClient.electron.transferUser({ fetchOptions: { query } });
            router.refresh();
          });
        }}
        type="button"
      >
        {isPending ? (
          <>
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          "Continue to desktop app"
        )}
      </Button>

      <a
        className={buttonVariants({ className: "w-full", variant: "ghost" })}
        href={useAnotherAccountHref}
      >
        Use another account
      </a>
    </div>
  );
};
export { ElectronBrowserSignIn, ElectronTransferUser };
