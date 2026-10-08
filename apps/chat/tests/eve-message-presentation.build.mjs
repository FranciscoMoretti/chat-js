import { build } from "bun";

// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture builder waits for its bundle before publishing JavaScript to stdout.
const result = await build({
  define: {
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  entrypoints: ["tests/eve-message-presentation.fixture.tsx"],
  plugins: [
    {
      name: "presentation-fixture-boundaries",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Register onResolve/onLoad callbacks on Bun's original shared PluginBuilder; these calls mutate the build's resolver/loader registry.
      setup(builder) {
        builder.onResolve({ filter: /^next\/image$/u }, () => ({
          namespace: "fixture",
          path: "fixture-next-image",
        }));
        builder.onLoad({ filter: /.*/u, namespace: "fixture" }, () => ({
          contents:
            'import {createElement} from "react";export default function Image(props){return createElement("img",props)}',
          loader: "jsx",
        }));
      },
    },
  ],
  target: "browser",
});

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
// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture builder reads the completed bundle before writing its JavaScript to stdout.
process.stdout.write(await result.outputs[0].text());
/* oxlint-enable no-magic-numbers */
