"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import config from "@/chat.config";
import type { Session } from "@/lib/auth";
import authClient from "@/lib/auth-client";

import { Button } from "./ui/button";

export function ElectronBrowserSignIn({
  buttonLabel = "Continue with browser",
}: {
  buttonLabel?: string;
}) {
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
          const requestAuth = window.requestAuth;
          if (typeof requestAuth !== "function") {
            return;
          }
          Promise.resolve()
            .then(() => requestAuth())
            .catch((error) => {
              console.error("Failed to launch browser sign-in", error);
            });
          window.setTimeout(() => setOpened(true), 300);
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
}

export function ElectronTransferUser({
  query,
  session,
}: {
  query: Record<string, string>;
  session: Session;
}) {
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
    return nextQuery ? `/login?${nextQuery}` : "/login";
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

      <Button asChild className="w-full" variant="ghost">
        <a href={useAnotherAccountHref}>Use another account</a>
      </Button>
    </div>
  );
}
