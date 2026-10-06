import type { JSX } from "react";

declare const RegisteredEveProjects: () => Promise<JSX.Element | null>;
/* oxlint-disable import/no-named-export, import/prefer-default-export -- The native browser fixture consumes the named private initializer signature supplied by its Vite source loader. */
export { RegisteredEveProjects };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
