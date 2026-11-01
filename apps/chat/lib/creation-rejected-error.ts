/** A plugin rejected a new reservation before any native dispatch. */
export class CreationRejectedError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "CreationRejectedError";
  }
}
