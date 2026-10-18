class EveForkBoundaryError extends Error {
  public constructor() {
    super("The edited message is not a user message in this conversation.");
    this.name = "EveForkBoundaryError";
  }
}

export { EveForkBoundaryError };
