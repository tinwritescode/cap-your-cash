import { createFileRoute } from "@tanstack/react-router";
import { AgentsPortal, PUBLIC_ORIGIN } from "@/components/agents-portal";
export const Route = createFileRoute("/agents")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Agents & API — CapMoney" },
      { name: "description", content: "Kết nối AI agent với CapMoney qua API key: ghi thu chi, xem số dư, báo cáo. Có sẵn prompt cho ChatGPT, Claude." },
      { property: "og:title", content: "Agents & API — CapMoney" },
      { property: "og:description", content: "Điều khiển CapMoney bằng AI qua API key, kèm prompt sẵn dùng." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${PUBLIC_ORIGIN}/agents` }],
  }),
  component: AgentsPortal,
});

