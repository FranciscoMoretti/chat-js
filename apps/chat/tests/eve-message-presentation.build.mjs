import { build } from "bun";

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): result accepts builder; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const result = await build({
  define: {
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  entrypoints: ["tests/eve-message-presentation.fixture.tsx"],
  plugins: [
    {
      name: "presentation-fixture-boundaries",
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): if (!result.success) { throw new Error(result.logs.map( accepts entry; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
if (!result.success) {
  throw new Error(result.logs.map((entry) => entry.message).join("\n"));
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): process.stdout.write uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
process.stdout.write(await result.outputs[0].text());
/* oxlint-enable no-magic-numbers */
