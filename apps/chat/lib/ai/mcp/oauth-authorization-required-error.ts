/**
 * Signals that OAuth authorization must be completed before the MCP client can continue.
 */
export class OAuthAuthorizationRequiredError extends Error {
  authorizationUrl: URL;

  constructor(authorizationUrl: URL) {
    super("OAuth user authorization required");
    this.name = "OAuthAuthorizationRequiredError";
    this.authorizationUrl = authorizationUrl;
  }
}
