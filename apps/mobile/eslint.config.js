// ESLint flat config for the Expo app (#73). Uses Expo's own shared rules.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/**", "dist-*/**", ".expo/**", "node_modules/**"] },
  {
    // Node test scripts run under `node --test`, not in the app.
    files: ["test/**/*.cjs"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable" } },
  },
]);
