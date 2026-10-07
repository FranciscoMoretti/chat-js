/* oxlint-disable oxc/no-async-await -- Native async Actions and operations preserve awaited sequencing and route rejections to their declared owner. */
// A session refresh failure cannot undo a completed native sign-out.
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Repository guidance requires this named helper; the pinned import/no-default-export rule rejects the suggested default export. */
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

/* oxlint-enable oxc/no-async-await */

/* oxlint-enable import/prefer-default-export, import/no-named-export */
