import type { electronAuthClient } from "./lib/auth-client";

declare global {
  type Bridges = typeof electronAuthClient.$Infer.Bridges;
  type ElectronRendererAuthState =
    | {
        readonly status: "idle";
        readonly message: null;
      }
    | {
        readonly status:
          | "awaiting-browser"
          | "finishing"
          | "timed-out"
          | "error";
        readonly message: string;
        readonly detail?: string | null;
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
