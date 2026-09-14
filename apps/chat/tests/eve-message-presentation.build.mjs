import { build } from "bun";

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
if (!result.success) {
  throw new Error(String(result.logs));
}
process.stdout.write(await result.outputs[0].text());
