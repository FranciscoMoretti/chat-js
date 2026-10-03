/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

/* oxlint-disable import/no-default-export -- postcss.config.mjs: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
export default config;
/* oxlint-enable import/no-default-export */
