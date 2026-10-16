// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        filename: "sw.js",
        injectRegister: null,
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"],
        manifest: false,
        devOptions: { enabled: false },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin, url }) =>
                sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "capmoney-pages",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ sameOrigin, url }) =>
                sameOrigin && /\/assets\/.*\.[a-z0-9]{8,}\.(js|css|woff2?|png|svg|webp)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "capmoney-static-assets",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
    // Pre-bundle lazily-discovered deps so the dev server never re-optimizes mid-session
    // (a re-optimize leaves open tabs with two React copies → "reading 'useState'" crash).
    optimizeDeps: {
      include: [
        "@radix-ui/react-popover",
        "@radix-ui/react-select",
        "date-fns/locale",
        "react-day-picker",
      ],
    },
  },
});
