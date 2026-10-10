// This declaration module augments Window and keeps both auth types globally available.
declare global {
  interface ElectronAuthErrorContext {
    message?: string;
    path?: string;
    status?: number;
    statusText?: string;
  }

  type ElectronRendererAuthState =
    | {
        status: "idle";
        message: null;
      }
    | {
        status: "awaiting-browser" | "finishing" | "timed-out" | "error";
        message: string;
        detail?: string | null;
      };

  interface Window {
    electronAPI?: {
      cancelAuthFlow?: () => Promise<void>;
      getAuthState?: () => Promise<ElectronRendererAuthState>;
      isElectron: boolean;
      onAuthStateChanged?: (
        callback: (state: Readonly<ElectronRendererAuthState>) => void
      ) => () => void;
      platform: string;
      syncAuthSession?: () => Promise<void>;
    };
    onAuthError?: (
      callback: (context: Readonly<ElectronAuthErrorContext>) => void
    ) => () => void;
    onAuthenticated?: (callback: (user: unknown) => void) => () => void;
    onUserUpdated?: (callback: (user: unknown) => void) => () => void;
    requestAuth?: (options?: {
      readonly provider?: string;
    }) => Promise<void> | void;
    signOut?: () => Promise<void>;
  }
}

// oxlint-disable-next-line import/no-named-export, unicorn/require-module-specifiers -- An external declaration module is required for declare global; this empty export preserves ambient types without exposing runtime values.
export {};
