/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/**
 * Signals that OAuth authorization must be completed before the MCP client can continue.
 */
export class OAuthAuthorizationRequiredError extends Error {
  public authorizationUrl: URL;

  public constructor(authorizationUrl: URL) {
    super("OAuth user authorization required");
    this.name = "OAuthAuthorizationRequiredError";
    this.authorizationUrl = authorizationUrl;
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
