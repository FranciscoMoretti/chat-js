type ReadonlyNativeSurface<Value> = Value extends (
  ...parameters: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? {
        readonly [Property in keyof Value]: ReadonlyNativeSurface<
          Value[Property]
        >;
      }
    : Value;

/**
 * Signals that OAuth authorization must be completed before the MCP client can continue.
 */
export class OAuthAuthorizationRequiredError extends Error {
  public authorizationUrl: URL;

  public constructor(authorizationUrl: ReadonlyNativeSurface<URL>) {
    super("OAuth user authorization required");
    this.name = "OAuthAuthorizationRequiredError";
    this.authorizationUrl = authorizationUrl;
  }
}
