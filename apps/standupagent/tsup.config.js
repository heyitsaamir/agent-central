import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"], // This will pick up all .ts files in src
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  outDir: "dist",
  noExternal: [/.*/], // This bundles all dependencies
});
