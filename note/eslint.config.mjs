import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rust/Tauri ビルド成果物（生成JSを lint しない）
    "src-tauri/**",
  ]),
  {
    rules: {
      // localStorage 等からの初期化・購読パターンで setState を同期呼びするのは正当なため、
      // ビルドを止めない警告レベルに緩和する。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
