/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { build } from "bun";

const imageImport = /^next\/image$/u;
const fixtureModule = /.*/u;
const replacedModule =
  /\/(?<module>chat-models-provider|session-provider|eve-artifact-layout|eve-conversation|chat-welcome|internal-link|connectors-dropdown)\.tsx$/u;

const mocks = `${process.cwd()}/tests/eve-comparison-ui.mocks.tsx`;
const replacements = {
  "chat-models-provider.tsx": "useChatModels",
  "chat-welcome.tsx": "ChatWelcomeView",
  "connectors-dropdown.tsx": "ConnectorsDropdown",
  "eve-artifact-layout.tsx": "EveArtifactLayout",
  "eve-conversation.tsx": "EveConversation",
  "internal-link.tsx": "InternalLink",
  "session-provider.tsx": "useSession",
};
const result = await build({
  define: {
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  entrypoints: [process.argv[2] ?? "tests/eve-comparison-ui.fixture.tsx"],
  plugins: [
    {
      name: "strict-comparison-fixture-boundaries",
      setup(builder) {
        builder.onResolve({ filter: imageImport }, () => ({
          path: "fixture-next-image",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: fixtureModule, namespace: "fixture" }, () => ({
          contents:
            'import {createElement} from "react";export default function Image(props){return createElement("img",props)}',
          loader: "jsx",
        }));
        builder.onLoad(
          {
            filter: replacedModule,
          },
          (args) => {
            const name = replacements[args.path.split("/").at(-1) ?? ""];
            if (!name) {
              throw new Error("Unexpected fixture replacement");
            }
            return {
              contents: `export { ${name} } from ${JSON.stringify(mocks)};`,
              loader: "tsx",
            };
          }
        );
      },
    },
  ],
  target: "browser",
});
if (!result.success) {
  throw new Error(String(result.logs));
}
process.stdout.write(await result.outputs[0].text());
