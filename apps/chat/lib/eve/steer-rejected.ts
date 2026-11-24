/** The native session did not admit the steering message. */
export class EveSteerRejectedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EveSteerRejectedError";
  }
}
