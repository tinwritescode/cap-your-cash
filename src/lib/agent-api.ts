// Public Agent API catalogue: single source for the HTTP router, the /agents docs and the AI prompt.
export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type ApiEndpoint = {
  method: ApiMethod;
  path: string; // relative to /api/public/v1, ":id" marks the id segment
  action: string; // api_dispatch action
  group: string;
  summary: string;
  params?: string;
  example?: Record<string, unknown>;
};

export const API_BASE_PATH = "/api/public/v1";

export const ENDPOINTS: ApiEndpoint[] = [
  { method: "GET", path: "/me", action: "me", group: "Tài khoản", summary: "Thông tin hồ sơ của chủ API key." },
  { method: "GET", path: "/wallets", action: "wallets.list", group: "Ví", summary: "Danh sách ví kèm số dư hiện tại (balance_vnd)." },
  { method: "POST", path: "/wallets", action: "wallets.create", group: "Ví", summary: "Tạo ví mới.", params: "name (1–40 ký tự), kind: cash | bank | credit, opening_balance_vnd", example: { name: "Tiền mặt", kind: "cash", opening_balance_vnd: 500000 } },
  { method: "GET", path: "/categories", action: "categories.list", group: "Danh mục", summary: "Danh sách danh mục.", params: "?type=expense|income" },
  { method: "POST", path: "/categories", action: "categories.create", group: "Danh mục", summary: "Tạo danh mục.", params: "name, type: expense | income, icon (emoji), parent_id?", example: { name: "Cà phê", type: "expense", icon: "☕" } },
  { method: "GET", path: "/transactions", action: "transactions.list", group: "Giao dịch", summary: "Giao dịch trong một tháng (mới nhất trước).", params: "?month=YYYY-MM-01&type=expense|income|transfer|journal&wallet_id=&limit=100 (tối đa 500)" },
  { method: "POST", path: "/transactions", action: "transactions.create", group: "Giao dịch", summary: "Ghi thu / chi / chuyển ví. Gửi lại cùng id sẽ không tạo trùng.", params: "type, amount_vnd (>0), source_wallet_id (chi, chuyển), dest_wallet_id (thu, chuyển), category_id (chi, thu), occurred_at (ISO), note (≤500), id? (uuid), photos? (tối đa 5 ảnh base64 hoặc data URL, JPEG/PNG/WebP ≤ 6MB; bắt buộc với journal)", example: { type: "expense", amount_vnd: 45000, source_wallet_id: "<wallet_id>", category_id: "<category_id>", note: "Cà phê sáng" } },
  { method: "POST", path: "/transactions/:id/photos", action: "transactions.photos.add", group: "Giao dịch", summary: "Thêm ảnh vào giao dịch đã có (tổng tối đa 5 ảnh).", params: "photos: [\"data:image/jpeg;base64,...\"] hoặc [{ data, content_type }], version?", example: { photos: ["data:image/jpeg;base64,<...>"] } },
  { method: "GET", path: "/transactions/:id", action: "transactions.get", group: "Giao dịch", summary: "Chi tiết một giao dịch (kèm version)." },
  { method: "PATCH", path: "/transactions/:id", action: "transactions.update", group: "Giao dịch", summary: "Sửa giao dịch. Cần version hiện tại; gửi đủ các trường.", params: "version, amount_vnd, source_wallet_id, dest_wallet_id, category_id, occurred_at, note", example: { version: 1, amount_vnd: 50000, source_wallet_id: "<wallet_id>", category_id: "<category_id>", occurred_at: "2026-10-16T08:00:00+07:00", note: "Cà phê" } },
  { method: "DELETE", path: "/transactions/:id", action: "transactions.trash", group: "Giao dịch", summary: "Chuyển vào thùng rác (giữ 30 ngày).", params: "?version=" },
  { method: "POST", path: "/transactions/:id/restore", action: "transactions.restore", group: "Thùng rác", summary: "Khôi phục từ thùng rác.", params: "version", example: { version: 2 } },
  { method: "GET", path: "/trash", action: "trash.list", group: "Thùng rác", summary: "Giao dịch đã xoá trong 30 ngày." },
  { method: "GET", path: "/reports/summary", action: "reports.summary", group: "Báo cáo", summary: "Tổng thu, chi và ngân sách của tháng.", params: "?month=YYYY-MM-01&wallet_id=" },
  { method: "GET", path: "/reports/daily", action: "reports.daily", group: "Báo cáo", summary: "Thu chi theo từng ngày.", params: "?month=YYYY-MM-01" },
  { method: "GET", path: "/reports/categories", action: "reports.categories", group: "Báo cáo", summary: "Chi tiêu theo danh mục.", params: "?month=YYYY-MM-01" },
  { method: "PUT", path: "/budgets", action: "budgets.set", group: "Báo cáo", summary: "Đặt ngân sách chi tiêu cho tháng.", params: "month (YYYY-MM-01), amount_vnd", example: { month: "2026-10-01", amount_vnd: 8000000 } },
];

/** Match an incoming request to an endpoint; returns the action and the :id value. */
export function matchEndpoint(method: string, subpath: string): { ep: ApiEndpoint; id?: string } | null {
  const parts = subpath.split("/").filter(Boolean);
  for (const ep of ENDPOINTS) {
    if (ep.method !== method) continue;
    const tpl = ep.path.split("/").filter(Boolean);
    if (tpl.length !== parts.length) continue;
    let id: string | undefined;
    const ok = tpl.every((t, i) => (t === ":id" ? ((id = parts[i]), true) : t === parts[i]));
    if (ok) return { ep, id };
  }
  return null;
}

export function curlFor(ep: ApiEndpoint, base: string) {
  const url = `${base}${API_BASE_PATH}${ep.path.replace(":id", "<id>")}`;
  const body = ep.example ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.example)}'` : "";
  return `curl -X ${ep.method} "${url}" \\\n  -H "Authorization: Bearer $CAPMONEY_API_KEY"${body}`;
}

export function buildAgentPrompt(base: string) {
  const list = ENDPOINTS.map((e) => `- ${e.method} ${e.path} — ${e.summary}${e.params ? ` Tham số: ${e.params}.` : ""}`).join("\n");
  return `Bạn là trợ lý tài chính cá nhân điều khiển ứng dụng CapMoney qua HTTP API.

# Kết nối
- Base URL: ${base}${API_BASE_PATH}
- Mọi request gửi header: Authorization: Bearer <CAPMONEY_API_KEY> (hoặc x-api-key).
- Body là JSON. Phản hồi: { "data": ... } khi thành công, { "error": "..." } khi lỗi (401 key sai, 400 dữ liệu sai, 404 không thấy, 409 xung đột version).

# Quy tắc nghiệp vụ
- Tiền tệ VND, số nguyên, không có phần thập phân (45.000đ = 45000).
- Múi giờ Asia/Ho_Chi_Minh (UTC+7). "Hôm nay", "tháng này" tính theo giờ Việt Nam. Tháng truyền dạng YYYY-MM-01.
- Loại giao dịch: expense (chi: cần source_wallet_id + category_id expense), income (thu: cần dest_wallet_id + category_id income), transfer (chuyển ví: cần source_wallet_id và dest_wallet_id khác nhau, không có category), journal (nhật ký ảnh 0đ: amount_vnd = 0, source_wallet_id tuỳ chọn, category_id expense tuỳ chọn, bắt buộc gửi kèm ít nhất 1 ảnh trong "photos").
- Ảnh: gửi trong trường "photos" là mảng chuỗi base64 / data URL (data:image/jpeg;base64,...) hoặc { data, content_type }. Tối đa 5 ảnh mỗi giao dịch, mỗi ảnh ≤ 6MB, định dạng JPEG/PNG/WebP. Thêm ảnh cho giao dịch cũ: POST /transactions/:id/photos.
- Trước khi ghi giao dịch, gọi GET /wallets và GET /categories để lấy đúng id; không bịa id. Nếu không chắc ví/danh mục, hỏi lại người dùng.
- Sửa/xoá/khôi phục cần "version" mới nhất: gọi GET /transactions/:id trước. Lỗi 409 nghĩa là dữ liệu đã đổi, hãy đọc lại.
- Xoá chỉ đưa vào thùng rác 30 ngày, có thể khôi phục.
- Khi tạo giao dịch, có thể tự sinh "id" (UUID v4) để gửi lại an toàn khi mạng lỗi mà không tạo trùng.
- Trả lời người dùng bằng tiếng Việt, hiển thị tiền dạng 1.234.000đ. Xác nhận lại trước khi xoá hoặc sửa số tiền lớn.

# Endpoints
${list}`;
}
