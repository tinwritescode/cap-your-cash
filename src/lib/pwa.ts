import { registerSW } from "virtual:pwa-register";

const PREVIEW_HOSTS = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
const APP_SW_PATH = "/sw.js";

function hostMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    PREVIEW_HOSTS.some((domain) => hostMatches(hostname, domain))
  );
}

async function unregisterAppShellWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptURL = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? registration.waiting?.scriptURL;
      if (!scriptURL) return;
      if (new URL(scriptURL).pathname === APP_SW_PATH) {
        await registration.unregister();
      }
    }),
  );
}

function shouldRegisterAppShellWorker() {
  if (!import.meta.env.PROD) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (window.self !== window.top) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return !isPreviewHost(window.location.hostname);
}

export async function setupPwaCache() {
  if (!shouldRegisterAppShellWorker()) {
    await unregisterAppShellWorker();
    return;
  }

  registerSW({ immediate: true });
}