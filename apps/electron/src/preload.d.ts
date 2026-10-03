import type { electronAuthClient } from "./lib/auth-client";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- global: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
declare global {
  type Bridges = typeof electronAuthClient.$Infer.Bridges;
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
  interface Window extends Bridges {
    electronAPI?: {
      cancelAuthFlow?: () => Promise<void>;
      getAuthState?: () => Promise<ElectronRendererAuthState>;
      isElectron: boolean;
      onAuthStateChanged?: (
        callback: (state: ElectronRendererAuthState) => void
      ) => () => void;
      platform: NodeJS.Platform;
      syncAuthSession?: () => Promise<void>;
    };
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
