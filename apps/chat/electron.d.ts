// This ambient declaration intentionally augments the global Window interface; adding an export would change its scope.
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

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): Window accepts state: ElectronRendererAuthState; context: ElectronAuthErrorContext; options?: { provider?: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
