"use client";
import { isElectronRenderer } from "./bridge";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { AuthFormView } from "@/components/auth-form-view";
import { SocialAuthProviders } from "@/components/auth-providers";
import authClient from "@/lib/auth-client";
import {
  buildSocialAuthRequest,
  isElectronTransferQuery,
} from "./electron-auth";
import { ElectronBrowserSignIn, ElectronTransferUser } from "./auth-ui";

// Preload capabilities are fixed for the lifetime of the renderer.
const subscribe = () => () => {
  /* No subscription to release. */
};
const BrowserTransfer = ({
  mode,
  query,
}: {
  readonly mode: "login" | "register";
  readonly query: Readonly<Record<string, string>>;
}) => {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return (
      <AuthCardSkeleton
        title="Connecting…"
        description="Connecting your desktop app"
      />
    );
  }
  if (session?.user) {
    return <ElectronTransferUser query={query} session={session} />;
  }
  const request = buildSocialAuthRequest(query, globalThis.location?.origin);
  return (
    <AuthFormView mode={mode} query={query}>
      <SocialAuthProviders {...request} query={query} />
    </AuthFormView>
  );
};

export const DesktopAuthForm = ({
  mode,
  children,
}: {
  readonly mode: "login" | "register";
  readonly children: ReactNode;
}): ReactNode => {
  const query = Object.fromEntries(useSearchParams().entries());
  const native = useSyncExternalStore(
    subscribe,
    isElectronRenderer,
    () => false
  );
  if (native) {
    return (
      <AuthFormView
        mode={mode}
        query={query}
        title="Continue in browser"
        description="Use your browser to sign in or create an account."
        footer={
          <div className="text-muted-foreground text-center text-sm">
            New and existing accounts both continue through the browser flow.
          </div>
        }
      >
        <ElectronBrowserSignIn buttonLabel="Continue in browser" />
      </AuthFormView>
    );
  }
  if (isElectronTransferQuery(query)) {
    return <BrowserTransfer mode={mode} query={query} />;
  }
  return children;
};
