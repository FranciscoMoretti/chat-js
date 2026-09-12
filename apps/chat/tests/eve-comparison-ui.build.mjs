import { build } from "bun";

const imageImport = /^next\/image$/;
const fixtureModule = /.*/;
const replacedModule =
  /\/(chat-models-provider|session-provider|eve-artifact-layout|eve-conversation|chat-welcome|internal-link|connectors-dropdown)\.tsx$/;

const mocks = `${process.cwd()}/tests/eve-comparison-ui.mocks.tsx`;
const replacements = {
  "chat-models-provider.tsx": "useChatModels",
  "session-provider.tsx": "useSession",
  "eve-artifact-layout.tsx": "EveArtifactLayout",
  "eve-conversation.tsx": "EveConversation",
  "chat-welcome.tsx": "ChatWelcomeView",
  "internal-link.tsx": "InternalLink",
  "connectors-dropdown.tsx": "ConnectorsDropdown",
};
const result = await build({
  entrypoints: ["tests/eve-comparison-ui.fixture.tsx"],
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
    "process.env": "{}",
  },
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
});
if (!result.success) {
  throw new Error(String(result.logs));
}
process.stdout.write(await result.outputs[0].text());
