import { cyan, dim, green, red, yellow } from "kleur/colors";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (highlighter); the enabled import/no-default-export convention rejects the default-export alternative. */
export const highlighter = {
  dim,
  error: red,
  info: cyan,
  success: green,
  warn: yellow,
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
