// Understands bot messages (text or receipt photo) with Lovable AI (Responses API, streamed).
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export type Intent = {
  intent: "record" | "query" | "help" | "chat";
  type: "expense" | "income" | "transfer" | null;
  amount_vnd: number | null;
  wallet: string | null;
  dest_wallet: string | null;
  category: string | null;
  note: string | null;
  occurred_at: string | null;
  period: "today" | "yesterday" | "week" | "month" | "last_month" | null;
  query: "balance" | "spending" | "report" | "budget" | null;
  reply: string | null;
};

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, "null"], ...extra });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "type", "amount_vnd", "wallet", "dest_wallet", "category", "note", "occurred_at", "period", "query", "reply"],
  properties: {
    intent: { type: "string", enum: ["record", "query", "help", "chat"] },
    type: nullable("string", { enum: ["expense", "income", "transfer", null] }),
    amount_vnd: nullable("integer"),
    wallet: nullable("string"),
    dest_wallet: nullable("string"),
    category: nullable("string"),
    note: nullable("string"),
    occurred_at: nullable("string"),
    period: nullable("string", { enum: ["today", "yesterday", "week", "month", "last_month", null] }),
    query: nullable("string", { enum: ["balance", "spending", "report", "budget", null] }),
    reply: nullable("string"),
  },
};

export async function understand(opts: {
  text: string;
  imageDataUrl?: string;
  wallets: string[];
  categories: { name: string; type: string }[];
  nowLocal: string;
}): Promise<Intent> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const instructions = `Bạn là trợ lý ghi chép thu chi của ứng dụng CapMoney (tiền VND, giờ Việt Nam). Bây giờ là ${opts.nowLocal} (UTC+7).
Ví của người dùng: ${opts.wallets.join(", ") || "(chưa có)"}.
Danh mục chi: ${opts.categories.filter((c) => c.type === "expense").map((c) => c.name).join(", ")}.
Danh mục thu: ${opts.categories.filter((c) => c.type === "income").map((c) => c.name).join(", ")}.

Phân loại tin nhắn:
- intent "record": người dùng muốn ghi một khoản chi/thu/chuyển ví, hoặc gửi ảnh hoá đơn/biên lai. Điền type, amount_vnd (số nguyên VND; "35k" = 35000, "1tr2" = 1200000, "2 triệu" = 2000000), wallet (tên ví đúng y như danh sách, null nếu không nói), dest_wallet (chỉ khi chuyển ví hoặc thu), category (tên danh mục đúng y như danh sách, chọn cái hợp nhất), note (mô tả ngắn tiếng Việt, ví dụ tên quán/món), occurred_at (ISO 8601 có +07:00 nếu người dùng nói thời điểm khác "bây giờ", hoặc ngày trên hoá đơn; nếu không thì null).
  Với ảnh hoá đơn: amount_vnd là TỔNG TIỀN phải trả; note là tên cửa hàng + món chính.
- intent "query": hỏi số dư (query "balance"), tổng chi tiêu (query "spending"), báo cáo theo danh mục (query "report"), ngân sách (query "budget"). Chọn period: today, yesterday, week, month, last_month (mặc định month, riêng balance để null).
- intent "help": hỏi cách dùng bot.
- intent "chat": còn lại; reply là câu trả lời ngắn gọn, thân thiện bằng tiếng Việt.
Các trường không dùng để null. Nếu ảnh không phải hoá đơn và không có số tiền, dùng intent "chat" và giải thích ngắn trong reply.`;

  const content: Record<string, unknown>[] = [{ type: "input_text", text: opts.text || "(ảnh hoá đơn)" }];
  if (opts.imageDataUrl) content.push({ type: "input_image", image_url: opts.imageDataUrl });

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input: [{ role: "user", content }],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "bot_intent", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error(`AI request failed [${res.status}]: ${body}`);
    throw new AiError(res.status);
  }

  // Collect streamed output text from Server-Sent Events.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new AiError(500);
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  try {
    return JSON.parse(out) as Intent;
  } catch {
    throw new AiError(500);
  }
}

export class AiError extends Error {
  constructor(public status: number) {
    super(`AI error ${status}`);
  }
  get userMessage() {
    if (this.status === 402) return "Hết lượt AI của ứng dụng. Bạn vẫn dùng được các lệnh /sodu, /homnay, /tuan, /thang.";
    if (this.status === 429) return "AI đang bận, thử lại sau ít phút nhé.";
    return "Mình chưa hiểu được tin này, bạn thử viết lại kiểu “cà phê 35k ví tiền mặt” nhé.";
  }
}
