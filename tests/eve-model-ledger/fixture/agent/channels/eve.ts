import { eveChannel } from "eve/channels/eve";

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
