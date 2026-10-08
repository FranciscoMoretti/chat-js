/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep this named error constructor available to the existing eve-queries module API; the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export class CreationConflictError extends Error {
  public readonly code: "creation_conflict" | "creation_in_progress";
  public constructor(
    message?: string,
    options?: Readonly<
      ErrorOptions & {
        code?: "creation_conflict" | "creation_in_progress";
      }
    >
  ) {
    super(message, options);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading code from options; preserve one receiver evaluation, skipped accesses and the existing "creation_conflict" fallback. The app guidance prefers optional chaining.
    this.code = options?.code ?? "creation_conflict";
    this.name = "CreationConflictError";
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
