import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, KeyRound, FlaskConical, BookText, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { API_BASE_PATH, ENDPOINTS, buildAgentPrompt, curlFor } from "@/lib/agent-api";
import { ApiKeyManager } from "@/components/api-key-manager";
import { ApiPlayground } from "@/components/api-playground";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PUBLIC_ORIGIN = "https://money.tyvn.online";

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
  component: AgentsPage,
});

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">{icon} {title}</h2>
      {children}
    </section>
  );
}

function AgentsPage() {
  const [origin, setOrigin] = useState(PUBLIC_ORIGIN);
  const [key, setKey] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" /> CapMoney</Link></Button>
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Bot className="size-8 text-primary" /> Agents & API</h1>
        <p className="text-muted-foreground">Cho AI (ChatGPT, Claude, n8n, Cursor…) đọc và ghi thu chi của bạn bằng API key. Dán prompt bên dưới để AI hiểu cách dùng.</p>
      </header>

      <Section icon={<KeyRound className="size-5 text-primary" />} title="1. API key">
        <p className="text-sm text-muted-foreground">Mỗi key chỉ truy cập dữ liệu của chính bạn. Giữ bí mật như mật khẩu; thu hồi bất cứ lúc nào.</p>
        <ApiKeyManager onCreated={setKey} />
      </Section>

      <Section icon={<Bot className="size-5 text-primary" />} title="2. Prompt cho AI">
        <p className="text-sm text-muted-foreground">Dán vào System Prompt / Custom Instructions của agent, kèm API key của bạn.</p>
        <CodeBlock code={buildAgentPrompt(origin)} label="system prompt" maxHeight="max-h-96" />
      </Section>

      <Section icon={<FlaskConical className="size-5 text-primary" />} title="3. Thử trực tiếp">
        <ApiPlayground apiKey={key} onKeyChange={setKey} />
      </Section>

      <Section icon={<BookText className="size-5 text-primary" />} title="4. Tài liệu endpoint">
        <p className="text-sm text-muted-foreground">Base URL <code className="rounded bg-surface-2 px-1.5 py-0.5">{origin}{API_BASE_PATH}</code> · Header <code className="rounded bg-surface-2 px-1.5 py-0.5">Authorization: Bearer cm_…</code></p>
        {groups.map((g) => (
          <div key={g} className="space-y-2">
            <h3 className="pt-2 font-semibold">{g}</h3>
            {ENDPOINTS.filter((e) => e.group === g).map((e) => (
              <div key={e.method + e.path} className="space-y-2 rounded-2xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.method === "GET" ? "secondary" : "default"}>{e.method}</Badge>
                  <code className="text-sm font-semibold">{e.path}</code>
                </div>
                <p className="text-sm">{e.summary}</p>
                {e.params && <p className="text-xs text-muted-foreground">{e.params}</p>}
                <CodeBlock code={curlFor(e, origin)} label="cURL" />
              </div>
            ))}
          </div>
        ))}
      </Section>
    </main>
  );
}
