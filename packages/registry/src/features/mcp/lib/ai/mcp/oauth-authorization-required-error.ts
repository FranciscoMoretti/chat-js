type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
      ? Value
      : Value extends object
        ? {
            readonly [Property in keyof Value]: ReadonlyNativeSurface<
              Value[Property]
            >;
          }
        : Value;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (OAuthAuthorizationRequiredError); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
