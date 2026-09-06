import { mkdir, writeFile } from "node:fs/promises";
import { required } from "../lib/env";
import { tokenFor } from "./identity";

// Development harness only. This script is not an HTTP route or login UI.
const directory = new URL("../evidence/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
	new URL("identity.cookies", directory),
	`curl ${required("APP_ORIGIN")} -H 'Cookie: chatjs_identity=${await tokenFor(process.argv[2] ?? "browser-alice")}'`,
	{ mode: 0o600 },
);
console.log(
	"Wrote local identity import file; signed token expires in one hour.",
);
