"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChatAccount } from "./chat/chat-account";
import { useSession } from "@/providers/session-provider";
import authClient from "@/lib/auth-client";
import { signOutWithPlugin } from "@/integrations/auth/sign-out";
import { signOutAndNavigate } from "@/lib/sign-out";

export const useAccountControl = () => {
  const [, startEventAction] = useTransition();
  const { data, isPending } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  return {
    user: data?.user,
    isPending,
    theme: resolvedTheme,
    onThemeChange: setTheme,
    onSignIn: () => {
      router.push("/login");
    },
    onSignOut: () => {
      startEventAction(async () => {
        await signOutAndNavigate({
          navigate: () => {
            globalThis.location.href = "/";
          },
          onFailure: () => {
            toast.error("Unable to sign out. Try again.");
          },
          signOut: async () => {
            if (!(await signOutWithPlugin())) {
              await authClient.signOut({ fetchOptions: { throw: true } });
            }
          },
        });
      });
    },
  };
};

export const SidebarUserNav = () => <ChatAccount {...useAccountControl()} />;
