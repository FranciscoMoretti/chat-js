"use client";

import { Github } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ElectronBrowserSignIn } from "@/components/electron-auth-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";
import {
  getEnabledSocialAuthProviders,
  isSocialAuthProvider,
  sortSocialAuthProvidersByLastUsed,
} from "@/lib/social-auth";
import type {
  SocialAuthProvider,
  SocialAuthSignInOptions,
} from "@/lib/social-auth";

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <title>Google</title>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const VercelIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <title>Vercel</title>
    <path d="M12 1L24 22H0L12 1z" />
  </svg>
);

type AuthProviderDefinition = {
  icon: ComponentType<{ className?: string }>;
  id: SocialAuthProvider;
  label: string;
};

const AUTH_PROVIDER_METADATA = {
  github: {
    icon: Github,
    label: "GitHub",
  },
  google: {
    icon: GoogleIcon,
    label: "Google",
  },
  vercel: {
    icon: VercelIcon,
    label: "Vercel",
  },
} satisfies Record<SocialAuthProvider, Omit<AuthProviderDefinition, "id">>;

export const SocialAuthProviders = ({
  callbackURL,
  electronBrowserLabel,
  isElectron = false,
  onRedirectToUrl,
  query = {},
  signInOptions,
}: {
  callbackURL?: string;
  electronBrowserLabel?: string;
  isElectron?: boolean;
  onRedirectToUrl?: (url: string) => void;
  query?: Record<string, string>;
  signInOptions?: SocialAuthSignInOptions;
} = {}) => {
  const [lastUsedProvider] = useState<SocialAuthProvider | null>(() => {
    const remembered = authClient.getLastUsedLoginMethod();
    return isSocialAuthProvider(remembered) ? remembered : null;
  });

  const providers = useMemo<AuthProviderDefinition[]>(() => {
    const providerDefinitions = getEnabledSocialAuthProviders(
      config.authentication
    ).map((id) => ({
      id,
      ...AUTH_PROVIDER_METADATA[id],
    }));

    return sortSocialAuthProvidersByLastUsed(
      providerDefinitions,
      lastUsedProvider
    );
  }, [lastUsedProvider]);

  // In the Electron app, use the @better-auth/electron bridges exposed by
  // setupRenderer() in the preload script. requestAuth() opens the sign-in
  // URL in the user's default browser with the proper PKCE params.
  if (config.desktopApp.enabled && isElectron) {
    return <ElectronBrowserSignIn buttonLabel={electronBrowserLabel} />;
  }

  const signIn = async (provider: SocialAuthProvider) => {
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        ...signInOptions,
        fetchOptions: {
          query,
        },
      });

      const redirectUrl = result.data?.url;
      if (redirectUrl) {
        onRedirectToUrl?.(redirectUrl);
      }
    } catch (error) {
      console.error(`Failed to start ${provider} sign-in`, error);
      toast.error("Couldn't start sign-in. Please try again.");
    }
  };

  return (
    <div className="space-y-2">
      {providers.map(({ icon: Icon, id, label }) => {
        const isLastUsed = id === lastUsedProvider;

        return (
          <Button
            className="relative w-full"
            key={id}
            onClick={() => signIn(id)}
            type="button"
            variant="outline"
          >
            <Icon className="mr-2 h-4 w-4" />
            Continue with {label}
            {isLastUsed ? (
              <Badge
                className="absolute top-0 right-2 h-5 -translate-y-1/2 px-1.5 text-[10px]"
                variant="default"
              >
                Last used
              </Badge>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
};
