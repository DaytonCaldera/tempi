import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (npm test). They cover the logic that decides what happens to stock and dates: pure functions, no
 * database or browser. Test files sit next to the code they test: lib/foo.test.ts tests lib/foo.ts.
 */
export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    test: {
        include: ["**/*.test.ts"],
        exclude: ["node_modules/**", ".next/**"],
        environment: "node",
    },
});
