/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveCreationRecoveryError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export class EveCreationRecoveryError extends Error {
  public constructor() {
    super(
      "A previous conversation is still being recovered. Retry shortly; your request has been saved."
    );
    this.name = "EveCreationRecoveryError";
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
