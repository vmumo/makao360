import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      pages: [
        { path: "/" },
        { path: "/product" },
        { path: "/landlords" },
        { path: "/mobile-preview" },
        { path: "/help" },
        { path: "/security" },
        { path: "/legal/cookies" },
        { path: "/legal/privacy" },
        { path: "/legal/terms" },
        { path: "/login" },
        { path: "/signup" },
      ],
      prerender: { enabled: true },
    }),
    react(),
  ],
  server: { host: "127.0.0.1", port: 3000 },
});
