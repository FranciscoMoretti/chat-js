"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AnonymousSessionInit } from "@/components/anonymous-session-init";
import { AppRuntimeSlot } from "@/components/chat-runtime-controller";
import {
  type AppRuntimeData,
  type CreateAppRuntimeInput,
  createAppRuntimeInput,
  ProvisionalAppRuntimeIdentityProvider,
  useProvisionalAppRuntimeIdentity,
} from "@/lib/app-chat-runtime";
import { RuntimeRegistryProvider, RuntimeSlots } from "@/lib/runtime-registry";
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

interface ChatProvidersProps {
  children: React.ReactNode;
}

function getProvisionalRuntimeScopeKey(pathname: string | null) {
  const route = parseChatIdFromPathname(pathname);

  if (route.type === "home") {
    return "home";
  }

  if (route.type === "projectHome") {
    return `project:${route.projectId}`;
  }

  return null;
}

export function ChatProviders({ children }: ChatProvidersProps) {
  const pathname = usePathname();
  const provisionalRuntime = useProvisionalAppRuntimeIdentity(
    getProvisionalRuntimeScopeKey(pathname)
  );
  const initialRuntimes = useMemo<CreateAppRuntimeInput[]>(() => {
    if (!provisionalRuntime) {
      return [];
    }

    return [
      createAppRuntimeInput({
        bootstrap: false,
        runtimeId: provisionalRuntime.runtimeId,
      }),
    ];
  }, [provisionalRuntime]);

  return (
    <>
      <AnonymousSessionInit />
      <RuntimeRegistryProvider initialRuntimes={initialRuntimes}>
        <ProvisionalAppRuntimeIdentityProvider identity={provisionalRuntime}>
          <RuntimeSlots<AppRuntimeData>>
            {(runtime) => <AppRuntimeSlot runtime={runtime} />}
          </RuntimeSlots>
          {children}
        </ProvisionalAppRuntimeIdentityProvider>
      </RuntimeRegistryProvider>
    </>
  );
}
