// A session refresh failure cannot undo a completed native sign-out.
export const signOutAndNavigate = async ({
  signOut,
  syncSession,
  navigate,
  onFailure,
  onSyncFailure,
}: {
  readonly signOut: () => Promise<unknown>;
  readonly syncSession?: () => Promise<unknown>;
  readonly navigate: () => void;
  readonly onFailure: () => void;
  readonly onSyncFailure: (error: unknown) => void;
}): Promise<void> => {
  try {
    await signOut();
  } catch {
    onFailure();
    return;
  }
  if (syncSession) {
    try {
      await syncSession();
    } catch (error) {
      onSyncFailure(error);
    }
  }
  navigate();
};
