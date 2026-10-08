/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { build } from "bun";

const imageImport = /^next\/image$/u;
const navigationImport = /^next\/navigation$/u;
const replacedModule =
  /\/(?<module>chat-models-provider|session-provider|eve-artifact-layout|eve-conversation|chat-welcome-view|internal-link|features\/mcp\/composer)\.tsx$/u;

const mocks = `${process.cwd()}/tests/eve-comparison-ui.mocks.tsx`;
/** @type {Record<string, string>} */
const replacements = {
  "chat-models-provider.tsx": "useChatModels",
  "chat-welcome-view.tsx": "ChatWelcomeView",
  "composer.tsx": "ConnectorsControl",
  "eve-artifact-layout.tsx": "EveArtifactLayout",
  "eve-conversation.tsx": "EveConversation",
  "internal-link.tsx": "InternalLink",
  "session-provider.tsx": "useSession",
};
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): result uses 2, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture builder waits for its comparison bundle before publishing it to stdout.
const result = await build({
  define: {
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  entrypoints: [process.argv[2] ?? "tests/eve-followups-ui.fixture.tsx"],
  plugins: [
    {
      name: "strict-comparison-fixture-boundaries",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Register onResolve/onLoad callbacks on Bun's original shared PluginBuilder; these calls mutate the build's resolver/loader registry.
      setup(builder) {
        builder.onResolve({ filter: imageImport }, () => ({
          path: "fixture-next-image",
          namespace: "fixture",
        }));
        builder.onResolve({ filter: navigationImport }, () => ({
          path: "fixture-next-navigation",
          namespace: "fixture",
        }));
        builder.onLoad(
          { filter: /fixture-next-navigation/u, namespace: "fixture" },
          () => ({
            contents: `export {usePathname,useRouter} from ${JSON.stringify(mocks)}`,
            loader: "tsx",
          })
        );
        builder.onLoad(
          { filter: /fixture-next-image/u, namespace: "fixture" },
          () => ({
            contents:
              'import {createElement} from "react";export default function Image(props){return createElement("img",props)}',
            loader: "jsx",
          })
        );
        builder.onLoad(
          {
            filter: replacedModule,
          },
          /**
           * @param {Readonly<{path: string}>} args Resolved module path used to select a fixture replacement.
           * @returns {{contents: string, loader: "tsx"}} Source that re-exports the matching fixture mock.
           */
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
/* oxlint-enable no-magic-numbers */

if (!result.success) {
  throw new Error(
    result.logs
      .map(
        /**
         * @param {Readonly<{message: string}>} entry Build diagnostic to include in the failure output.
         * @returns {string} Diagnostic message displayed in the build error.
         */
        (entry) => entry.message
      )
      .join("\n")
  );
}

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): process.stdout.write uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture builder reads the completed comparison bundle before writing it to stdout.
process.stdout.write(await result.outputs[0].text());
/* oxlint-enable no-magic-numbers */
