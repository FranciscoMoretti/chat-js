/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named EveCreationRecoveryError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): EveCreationRecoveryError remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export class EveCreationRecoveryError extends Error {
  public constructor() {
    super(
      "A previous conversation is still being recovered. Retry shortly; your request has been saved."
    );
    this.name = "EveCreationRecoveryError";
  }
}
/* oxlint-enable import/no-named-export, import/prefer-default-export */
