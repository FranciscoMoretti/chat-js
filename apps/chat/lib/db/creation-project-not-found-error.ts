export class CreationProjectNotFoundError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "CreationProjectNotFoundError";
  }
}
