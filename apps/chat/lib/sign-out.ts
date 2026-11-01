export const signOutAndNavigate = async ({
  signOut,
  navigate,
  onFailure,
}: {
  readonly signOut: () => Promise<unknown>;
  readonly navigate: () => void;
  readonly onFailure: () => void;
}): Promise<void> => {
  try {
    await signOut();
  } catch {
    onFailure();
    return;
  }
  navigate();
};
