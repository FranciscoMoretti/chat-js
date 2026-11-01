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
    this.code = options?.code ?? "creation_conflict";
    this.name = "CreationConflictError";
  }
}
