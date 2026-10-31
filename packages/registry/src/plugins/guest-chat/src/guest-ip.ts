import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { env } from "@/lib/env";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const eveGuestIpHash = (address: string, secret: string): string => {
  if (!(address && secret)) {
    throw new Error("A trusted client address and server secret are required.");
  }
  return createHmac("sha256", secret)
    .update(`eve-guest-ip:${address}`)
    .digest("hex");
};

const IPV6_VERSION = 6;
const INVALID_IP_VERSION = 0;
const LEADING_BRACKET_LENGTH = 1;
const TRAILING_BRACKET_INDEX = -1;
const IPV4_OCTET_RANGE = 256;
const MAPPED_HIGH_WORD_GROUP = 1;
const MAPPED_LOW_WORD_GROUP = 2;

const MAPPED_IP = /^::ffff:(?<high>[0-9a-f]{1,4}):(?<low>[0-9a-f]{1,4})$/u;

/**
 * Hashes a trusted canonical client address; development uses the local address.
 * @param {ReadonlyNativeSurface<Request>} request Request whose configured proxy header supplies the client address outside development.
 * @returns {string} The keyed guest IP hash after mapped IPv6 normalization; unavailable or invalid addresses throw.
 */
const guestRequestIpHash = (
  request: ReadonlyNativeSurface<Request>
): string => {
  if (env.NODE_ENV === "development") {
    return eveGuestIpHash("127.0.0.1", env.AUTH_SECRET);
  }
  // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
  const header =
    typeof env.VERCEL_URL === "string" && env.VERCEL_URL !== ""
      ? "x-vercel-forwarded-for"
      : process.env.TRUSTED_CLIENT_IP_HEADER;
  const address =
    typeof header === "string" && header !== ""
      ? (request.headers.get(header) ?? "").trim()
      : "";
  if (
    address === "" ||
    isIP(address) === INVALID_IP_VERSION ||
    address.includes("%")
  ) {
    throw new Error("Trusted client address is unavailable.");
  }
  const canonical =
    isIP(address) === IPV6_VERSION
      ? new URL(`http://[${address}]`).hostname.slice(
          LEADING_BRACKET_LENGTH,
          TRAILING_BRACKET_INDEX
        )
      : address;
  const mapped = MAPPED_IP.exec(canonical);
  const normalized =
    mapped === null
      ? canonical
      : [
          Math.floor(
            Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) /
              IPV4_OCTET_RANGE
          ),
          Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) %
            IPV4_OCTET_RANGE,
          Math.floor(
            Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) /
              IPV4_OCTET_RANGE
          ),
          Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) % IPV4_OCTET_RANGE,
        ].join(".");
  return eveGuestIpHash(normalized, env.AUTH_SECRET);
};

export { guestRequestIpHash };
