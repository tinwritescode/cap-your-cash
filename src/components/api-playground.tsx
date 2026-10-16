import { useState } from "react";
import { Send } from "lucide-react";
import { API_BASE_PATH, ENDPOINTS } from "@/lib/agent-api";
import { AppSelect } from "@/components/pickers";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Send live requests to the Agent API with a pasted key. The key stays in component memory only. */
export function ApiPlayground({ apiKey, onKeyChange }: { apiKey: string; onKeyChange: (k: string) => void }) {
  const [idx, setIdx] = useState("1");
  const ep = ENDPOINTS[Number(idx)];
  const [id, setId] = useState("");
  const [query, setQuery] = useState("");
  const [body, setBody] = useState(ep.example ? JSON.stringify(ep.example, null, 2) : "");
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(v: string) {
    setIdx(v);
    const e = ENDPOINTS[Number(v)];
    setBody(e.example ? JSON.stringify(e.example, null, 2) : "");
    setOut(null);
  }

  async function send() {
    setBusy(true);
    try {
      const path = ep.path.replace(":id", id.trim());
      const qs = query.trim() ? `?${query.trim().replace(/^\?/, "")}` : "";
      const hasBody = ep.method !== "GET" && ep.method !== "DELETE" && body.trim();
      const res = await fetch(`${API_BASE_PATH}${path}${qs}`, {
        method: ep.method,
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...(hasBody ? { "Content-Type": "application/json" } : {}) },
        body: hasBody ? body : undefined,
      });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
      setOut(`HTTP ${res.status}\n\n${pretty}`);
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pg-key">API key</Label>
        <Input id="pg-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => onKeyChange(e.target.value)} placeholder="cm_…" />
      </div>
      <AppSelect aria-label="Endpoint" value={idx} onChange={pick} options={ENDPOINTS.map((e, i) => ({ value: String(i), label: `${e.method} ${e.path}` }))} />
      <p className="text-xs text-muted-foreground">{ep.summary}{ep.params ? ` — ${ep.params}` : ""}</p>
      {ep.path.includes(":id") && <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="id giao dịch (uuid)" />}
      {(ep.method === "GET" || ep.method === "DELETE") && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ep.method === "DELETE" ? "version=1" : "month=2026-10-01"} />}
      {ep.method !== "GET" && ep.method !== "DELETE" && <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />}
      <Button onClick={send} disabled={busy || !apiKey.trim()} className="w-full"><Send className="size-4" /> {busy ? "Đang gửi…" : "Gửi request"}</Button>
      {out && <CodeBlock code={out} label="Phản hồi" maxHeight="max-h-96" />}
    </div>
  );
}
