export class EveCreationRecoveryError extends Error {
  public constructor() {
    super(
      "A previous conversation is still being recovered. Retry shortly; your request has been saved."
    );
    this.name = "EveCreationRecoveryError";
  }
}
