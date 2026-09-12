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
      callback: (state: ElectronRendererAuthState) => void
    ) => () => void;
    platform: string;
    syncAuthSession?: () => Promise<void>;
  };
  onAuthError?: (
    callback: (context: ElectronAuthErrorContext) => void
  ) => () => void;
  onAuthenticated?: (callback: (user: unknown) => void) => () => void;
  onUserUpdated?: (callback: (user: unknown) => void) => () => void;
  requestAuth?: (options?: { provider?: string }) => Promise<void> | void;
  signOut?: () => Promise<void>;
}
