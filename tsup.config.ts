import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["./src/index.ts"],
  format: ["esm", "cjs"],
  legacyOutput: true,
  outDir: "dist",
  sourcemap: true,
});
