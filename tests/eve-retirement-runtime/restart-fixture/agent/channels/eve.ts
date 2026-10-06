import { eveChannel } from "eve/channels/eve";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- EVE supplies compiled callback contexts; the fixture reads their SDK-owned mutable types. */
// oxlint-disable-next-line import/no-default-export -- EVE's compiler discovers the fixture channel through its default export.
export default eveChannel({
  auth: (request) => {
    const credential = request.headers.get("authorization");
    const principalId =
      credential === "Bearer fixture-owner" ? "owner" : "foreign";
    return {
      attributes: {},
      authenticator: "fixture",
      principalId,
      principalType: "user",
    };
  },
});

/* oxlint-enable typescript/prefer-readonly-parameter-types */
