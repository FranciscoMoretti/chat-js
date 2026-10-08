/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep this named error constructor available to the existing eve-queries module API; the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export class CreationProjectNotFoundError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "CreationProjectNotFoundError";
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
