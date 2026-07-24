import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Base config for packages/* (plain TypeScript, no framework).
 * apps/web and apps/mobile each ship their own eslint.config — ESLint's
 * flat-config resolution finds the nearest one walking up from cwd, so
 * this file is never reached for those two apps.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.generated.*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Node scripts (tokens/strings sync) run outside the TS build, under plain Node.
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  }
);
