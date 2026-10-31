import { isElectronRenderer } from "./bridge";

export const signOutDesktop = async (): Promise<boolean> => {
  if (!isElectronRenderer()) {
    return false;
  }
  if (typeof window.signOut !== "function") {
    throw new TypeError("Desktop sign-out is unavailable.");
  }
  await window.signOut();
  try {
    await window.electronAPI?.syncAuthSession?.();
  } catch (error) {
    // A refresh failure cannot undo a completed native sign-out.
    console.error("Failed to refresh the signed-out desktop session", error);
  }
  return true;
};
