import { setupRenderer } from "@better-auth/electron/preload";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { contextBridge, ipcRenderer } from "electron";
/* oxlint-enable sort-imports */

// Setup @better-auth/electron renderer bridges.
// Exposes window.requestAuth(), window.onAuthenticated(), window.signOut(), etc.
setupRenderer();

/* oxlint-disable typescript/promise-function-async -- electronAPI: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
// Expose additional app metadata to the renderer process.
contextBridge.exposeInMainWorld("electronAPI", {
  cancelAuthFlow: () => ipcRenderer.invoke("chatjs:cancel-auth-flow"),
  getAuthState: () => ipcRenderer.invoke("chatjs:get-auth-state"),
  isElectron: true,
  onAuthStateChanged: (onStateChange: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown): void => {
      onStateChange(state);
    };

    ipcRenderer.on("chatjs:auth-state-changed", listener);
    return (): void => {
      ipcRenderer.removeListener("chatjs:auth-state-changed", listener);
    };
  },
  platform: process.platform,
  syncAuthSession: () => ipcRenderer.invoke("chatjs:sync-auth-session"),
});
/* oxlint-enable typescript/promise-function-async */
