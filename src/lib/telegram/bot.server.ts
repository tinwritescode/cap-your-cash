// Telegram bot logic (server-only). All financial reads/writes go through public._agent_dispatch,
// the same validated RPC path as the Agent API, impersonating the linked user.
import { formatDateTime, formatVnd } from "../finance";
import { AiError, understand, type Intent } from "./ai.server";
import { downloadFile, escapeHtml, hashCode, sendMessage, tg } from "./api.server";
import { budgetLevel, PERIOD_LABEL, periodRange, vnClock, type Period } from "./time";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Wallet = { id: string; name: string; kind: string; archived_at: string | null; balance_vnd: number | null };
type Category = { id: string; name: string; icon: string; type: string; archived_at: string | null };
type Link = { user_id: string; chat_id: number; notify_budget: boolean; budget_alert_month: string | null; budget_alert_level: number };
type Draft = {
  tx_id: string;
  type: "expense" | "income" | "transfer";
  amount_vnd: number;
  source_wallet_id: string | null;
  dest_wallet_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  photos: { id: string; original_path: string; thumb_path: string; sort_order: number }[];
};

const APP_URL = "https://money.tyvn.online";
const HELP = `<b>CapMoney bot</b> — ghi chép và xem chi tiêu ngay trong Telegram.

✍️ Nhắn kiểu: <i>cà phê 35k ví tiền mặt</i>, <i>đổ xăng 70k</i>, <i>lương 15tr</i>
📸 Gửi ảnh hoá đơn/biên lai để bot tự đọc số tiền
🎙 Gửi tin nhắn thoại: <i>tiền nhà ba củ</i>
❓ Hỏi: <i>tháng này chi bao nhiêu?</i>, <i>còn bao nhiêu tiền?</i>

Lệnh nhanh:
/sodu — số dư các ví
/homnay — thu chi hôm nay
/tuan — tuần này
/thang — tháng này theo danh mục
/thongbao — bật/tắt thông báo`;

async function admin(): Promise<Admin> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function dispatch<T = unknown>(db: Admin, uid: string, action: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc("_agent_dispatch", { uid, p_action: action, p_args: args as never });
  if (error) {
    const [, ...rest] = error.message.split(":");
    throw new UserError(rest.length ? rest.join(":") : "Lỗi máy chủ, thử lại sau nhé.");
  }
  return data as T;
}

class UserError extends Error {}

// ---------- entry ----------
type TgUser = { id: number; username?: string; first_name?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number; width: number }[];
  document?: { file_id: string; mime_type?: string; file_size?: number };
  voice?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
  audio?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
};

export async function handleUpdate(update: TgUpdate) {
  const db = await admin();
  const { error: dup } = await db.from("telegram_updates").insert({ update_id: update.update_id });
  if (dup) return; // already handled (Telegram retry)
  try {
    if (update.callback_query) await onCallback(db, update.callback_query);
    else if (update.message && update.message.chat.type === "private") await onMessage(db, update.message);
  } catch (e) {
    console.error(e);
    const chat = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chat) await sendMessage(chat, e instanceof UserError ? `⚠️ ${escapeHtml(e.message)}` : e instanceof AiError ? e.userMessage : "⚠️ Có lỗi xảy ra, thử lại sau nhé.");
  }
}

async function linkFor(db: Admin, chatId: number): Promise<Link | null> {
  const { data } = await db.from("telegram_links").select("user_id, chat_id, notify_budget, budget_alert_month, budget_alert_level").eq("chat_id", chatId).maybeSingle();
  return data as Link | null;
}

async function onMessage(db: Admin, msg: TgMessage) {
  const chatId = msg.chat.id;
  let text = (msg.text ?? msg.caption ?? "").trim();

  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    if (payload.startsWith("link_")) return startLink(db, msg, payload.slice(5));
    if (payload.startsWith("login_")) return startLogin(db, chatId, payload.slice(6));
  }

  const link = await linkFor(db, chatId);
  if (!link) {
    return sendMessage(chatId, `👋 Chào bạn! Telegram này chưa liên kết với CapMoney.\n\nMở <a href="${APP_URL}/profile">CapMoney → Cá nhân</a> và bấm <b>Liên kết Telegram</b>.`);
  }
  const uid = link.user_id;
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  if (cmd === "/start" || cmd === "/help") return sendMessage(chatId, HELP);
  if (cmd === "/sodu") return sendMessage(chatId, await balanceText(db, uid));
  if (cmd === "/homnay") return sendMessage(chatId, await spendingText(db, uid, "today", false));
  if (cmd === "/tuan") return sendMessage(chatId, await spendingText(db, uid, "week", true));
  if (cmd === "/thang" || cmd === "/baocao") return sendMessage(chatId, await spendingText(db, uid, "month", true));
  if (cmd === "/thongbao") return sendPrefs(db, chatId, uid);

  const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : msg.document?.mime_type?.startsWith("image/") ? msg.document : null;
  const voice = msg.voice ?? msg.audio ?? null;
  if (voice && !photo) {
    if ((voice.file_size ?? 0) > 8 * 1024 * 1024 || (voice.duration ?? 0) > 120) throw new UserError("Tin thoại quá dài (tối đa 2 phút).");
    await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const { transcribe } = await import("../stt.server");
    const audio = await downloadFile(voice.file_id);
    let heard: string;
    try { heard = await transcribe(new Uint8Array(audio), voice.mime_type ?? "audio/ogg", apiKey); }
    catch (e) { throw new AiError((e as { status?: number }).status ?? 500); }
    if (!heard) throw new UserError("Không nghe rõ, bạn nói lại nhé.");
    await sendMessage(chatId, `🎙 <i>${escapeHtml(heard)}</i>`);
    text = heard;
  }
  if (!photo && !text) return sendMessage(chatId, HELP);
  if (photo && (photo.file_size ?? 0) > 10 * 1024 * 1024) throw new UserError("Ảnh quá lớn (tối đa 10MB).");

  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);
  const [wallets, categories] = await Promise.all([
    dispatch<Wallet[]>(db, uid, "wallets.list"),
    dispatch<Category[]>(db, uid, "categories.list"),
  ]);
  const activeW = wallets.filter((w) => !w.archived_at);
  const activeC = categories.filter((c) => !c.archived_at);

  let bytes: Uint8Array | null = null;
  let dataUrl: string | undefined;
  if (photo) {
    bytes = await downloadFile(photo.file_id);
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    dataUrl = `data:image/${isPng ? "png" : "jpeg"};base64,${btoa(bin)}`;
  }

  const now = new Date();
  const intent = await understand({
    text,
    imageDataUrl: dataUrl,
    wallets: activeW.map((w) => w.name),
    categories: activeC.map((c) => ({ name: c.name, type: c.type })),
    nowLocal: formatDateTime(now),
  });

  if (intent.intent === "record") return createDraft(db, chatId, uid, intent, activeW, activeC, bytes);
  if (intent.intent === "query") {
    if (intent.query === "balance") return sendMessage(chatId, await balanceText(db, uid));
    if (intent.query === "budget") return sendMessage(chatId, await budgetText(db, uid));
    return sendMessage(chatId, await spendingText(db, uid, intent.period ?? "month", intent.query === "report" || intent.period !== "today"));
  }
  if (intent.intent === "help") return sendMessage(chatId, HELP);
  return sendMessage(chatId, escapeHtml(intent.reply ?? "Mình có thể giúp ghi chép chi tiêu và xem báo cáo. Gõ /help để xem hướng dẫn."));
}

// ---------- link & login ----------
async function startLink(db: Admin, msg: TgMessage, code: string) {
  const chatId = msg.chat.id;
  const { data: row } = await db.from("telegram_codes").select("*").eq("code_hash", await hashCode(code)).eq("purpose", "link").maybeSingle();
  if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date() || !row.user_id) {
    return sendMessage(chatId, "⏰ Mã liên kết đã hết hạn. Hãy bấm <b>Liên kết Telegram</b> lại trong app.");
  }
  await db.from("telegram_links").delete().or(`chat_id.eq.${chatId},user_id.eq.${row.user_id}`);
  const { error } = await db.from("telegram_links").insert({ user_id: row.user_id, chat_id: chatId, username: msg.from?.username ?? null, first_name: msg.from?.first_name ?? null });
  if (error) throw error;
  await db.from("telegram_codes").update({ status: "used", approved_user_id: row.user_id }).eq("code_hash", row.code_hash);
  await sendMessage(chatId, `✅ Đã liên kết với CapMoney!\n\n${HELP}`);
}

async function startLogin(db: Admin, chatId: number, code: string) {
  const codeHash = await hashCode(code);
  const { data: row } = await db.from("telegram_codes").select("*").eq("code_hash", codeHash).eq("purpose", "login").maybeSingle();
  if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date()) {
    return sendMessage(chatId, "⏰ Mã đăng nhập đã hết hạn. Hãy bấm <b>Đăng nhập bằng Telegram</b> lại trên web.");
  }
  const link = await linkFor(db, chatId);
  if (!link) {
    await db.from("telegram_codes").update({ status: "denied" }).eq("code_hash", codeHash);
    return sendMessage(chatId, `Telegram này chưa liên kết với tài khoản CapMoney nào.\n\nĐăng nhập bằng email hoặc Google trước, rồi vào <b>Cá nhân → Liên kết Telegram</b>. Lần sau sẽ đăng nhập được bằng Telegram.`);
  }
  await sendMessage(chatId, "🔐 Có yêu cầu đăng nhập CapMoney trên web. Đây có phải bạn không?", {
    reply_markup: { inline_keyboard: [[{ text: "✅ Đăng nhập", callback_data: `lg:${code}` }, { text: "❌ Không phải tôi", callback_data: `ld:${code}` }]] },
  });
}

// ---------- drafts ----------
function pickWallet(wallets: Wallet[], name: string | null) {
  const n = name?.toLowerCase().trim();
  return (n && (wallets.find((w) => w.name.toLowerCase() === n) ?? wallets.find((w) => w.name.toLowerCase().includes(n) || n.includes(w.name.toLowerCase())))) || null;
}
function pickCategory(cats: Category[], name: string | null, type: string) {
  const list = cats.filter((c) => c.type === type);
  const n = name?.toLowerCase().trim();
  return (n && list.find((c) => c.name.toLowerCase() === n)) || list.find((c) => /khác/i.test(c.name)) || list[0] || null;
}

async function createDraft(db: Admin, chatId: number, uid: string, it: Intent, wallets: Wallet[], cats: Category[], photo: Uint8Array | null) {
  const type = it.type ?? "expense";
  if (!it.amount_vnd || it.amount_vnd <= 0) throw new UserError("Mình chưa thấy số tiền. Thử lại kiểu “cà phê 35k” nhé.");
  if (!wallets.length) throw new UserError("Bạn chưa có ví nào. Tạo ví trong app trước nhé.");
  const def = wallets.find((w) => w.kind === "cash") ?? wallets[0];
  const w1 = pickWallet(wallets, it.wallet) ?? def;
  const w2 = pickWallet(wallets, it.dest_wallet);
  let occurred = it.occurred_at ? new Date(it.occurred_at) : new Date();
  if (Number.isNaN(occurred.getTime()) || occurred > new Date(Date.now() + 5 * 60_000)) occurred = new Date();

  const draft: Draft = {
    tx_id: crypto.randomUUID(),
    type,
    amount_vnd: Math.round(it.amount_vnd),
    source_wallet_id: type === "income" ? null : w1.id,
    dest_wallet_id: type === "income" ? (w2 ?? w1).id : type === "transfer" ? (w2 && w2.id !== w1.id ? w2.id : wallets.find((w) => w.id !== w1.id)?.id ?? null) : null,
    category_id: type === "transfer" ? null : pickCategory(cats, it.category, type)?.id ?? null,
    note: it.note?.slice(0, 500) ?? null,
    occurred_at: occurred.toISOString(),
    photos: [],
  };
  if (photo) {
    const photoId = crypto.randomUUID();
    const path = `${uid}/${draft.tx_id}/${photoId}.jpg`;
    const { error } = await db.storage.from("photos").upload(path, photo, { contentType: "image/jpeg", upsert: false });
    if (!error) draft.photos.push({ id: photoId, original_path: path, thumb_path: path, sort_order: 0 });
  }
  const { data: row, error } = await db.from("telegram_drafts").insert({ user_id: uid, chat_id: chatId, draft: draft as never }).select("id").single();
  if (error) throw error;
  const sent = await sendMessage(chatId, draftText(draft, wallets, cats), { reply_markup: draftKeyboard(row.id, draft) });
  if (sent) await db.from("telegram_drafts").update({ message_id: sent.message_id }).eq("id", row.id);
}

const TYPE_LABEL = { expense: "💸 Chi", income: "💰 Thu", transfer: "🔁 Chuyển ví" } as const;

function draftText(d: Draft, wallets: Wallet[], cats: Category[], head = "Kiểm tra lại trước khi lưu:") {
  const w = (id: string | null) => wallets.find((x) => x.id === id)?.name ?? "—";
  const c = cats.find((x) => x.id === d.category_id);
  const lines = [
    `<b>${head}</b>`,
    `${TYPE_LABEL[d.type]} <b>${formatVnd(d.amount_vnd)}</b>`,
    d.type === "transfer" ? `👛 ${escapeHtml(w(d.source_wallet_id))} → ${escapeHtml(w(d.dest_wallet_id))}` : `👛 Ví: ${escapeHtml(w(d.type === "income" ? d.dest_wallet_id : d.source_wallet_id))}`,
    c ? `🏷 ${c.icon} ${escapeHtml(c.name)}` : null,
    d.note ? `📝 ${escapeHtml(d.note)}` : null,
    `🕒 ${formatDateTime(d.occurred_at)}`,
    d.photos.length ? "📸 Kèm ảnh" : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function draftKeyboard(id: string, d: Draft) {
  const row2 = [{ text: "👛 Đổi ví", callback_data: `w:${id}` }];
  if (d.type !== "transfer") row2.push({ text: "🏷 Đổi danh mục", callback_data: `c:${id}` });
  return { inline_keyboard: [[{ text: "✅ Lưu", callback_data: `ok:${id}` }, { text: "❌ Huỷ", callback_data: `no:${id}` }], row2] };
}

// ---------- callbacks ----------
async function onCallback(db: Admin, q: NonNullable<TgUpdate["callback_query"]>) {
  const chatId = q.message?.chat.id ?? q.from.id;
  const messageId = q.message?.message_id;
  const [kind, id, extra] = (q.data ?? "").split(":");
  const answer = (text?: string) => tg("answerCallbackQuery", { callback_query_id: q.id, text }).catch(() => null);
  const edit = (text: string, reply_markup?: unknown) =>
    messageId ? tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup }).catch(() => null) : null;

  if (kind === "lg" || kind === "ld") {
    const codeHash = await hashCode(id);
    const link = await linkFor(db, chatId);
    const { data: row } = await db.from("telegram_codes").select("*").eq("code_hash", codeHash).eq("purpose", "login").maybeSingle();
    if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date() || !link) {
      await answer("Mã đã hết hạn");
      return edit("⏰ Yêu cầu đăng nhập đã hết hạn.");
    }
    if (kind === "ld") {
      await db.from("telegram_codes").update({ status: "denied" }).eq("code_hash", codeHash);
      await answer();
      return edit("🚫 Đã từ chối đăng nhập.");
    }
    await db.from("telegram_codes").update({ status: "approved", approved_user_id: link.user_id }).eq("code_hash", codeHash);
    await answer("Đã xác nhận");
    return edit("✅ Đã xác nhận. Quay lại trang web, bạn sẽ được đăng nhập tự động.");
  }

  const link = await linkFor(db, chatId);
  if (!link) return answer("Telegram chưa liên kết");
  const uid = link.user_id;

  if (kind === "nt") return togglePref(db, uid, id, chatId, messageId, answer);

  const { data: row } = await db.from("telegram_drafts").select("*").eq("id", id).eq("user_id", uid).maybeSingle();
  if (!row) {
    await answer("Bản nháp đã hết hạn");
    return edit("⏰ Bản nháp đã hết hạn hoặc đã xử lý.");
  }
  const d = row.draft as unknown as Draft;
  const [wallets, cats] = await Promise.all([dispatch<Wallet[]>(db, uid, "wallets.list"), dispatch<Category[]>(db, uid, "categories.list")]);
  const activeW = wallets.filter((w) => !w.archived_at);
  const activeC = cats.filter((c) => !c.archived_at && c.type === (d.type === "income" ? "income" : "expense"));

  if (kind === "no") {
    if (d.photos.length) await db.storage.from("photos").remove(d.photos.map((p) => p.original_path));
    await db.from("telegram_drafts").delete().eq("id", id);
    await answer("Đã huỷ");
    return edit(draftText(d, wallets, cats, "❌ Đã huỷ"));
  }
  if (kind === "ok") {
    await dispatch(db, uid, "transactions.create", {
      id: d.tx_id, type: d.type, amount_vnd: d.amount_vnd, source_wallet_id: d.source_wallet_id, dest_wallet_id: d.dest_wallet_id,
      category_id: d.category_id, occurred_at: d.occurred_at, note: d.note, photos: d.photos,
    });
    await db.from("telegram_drafts").delete().eq("id", id);
    await answer("Đã lưu");
    await edit(draftText(d, wallets, cats, "✅ Đã lưu"));
    if (d.type === "expense" && link.notify_budget) await checkBudget(db, link);
    return;
  }
  if (kind === "w" || kind === "c") {
    const items = kind === "w" ? activeW.map((w) => w.name) : activeC.map((c) => `${c.icon} ${c.name}`);
    const buttons = items.slice(0, 24).map((t, i) => ({ text: t, callback_data: `s${kind}:${id}:${i}` }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    await answer();
    return edit(draftText(d, wallets, cats, kind === "w" ? "Chọn ví:" : "Chọn danh mục:"), { inline_keyboard: rows });
  }
  if (kind === "sw" || kind === "sc") {
    const i = Number(extra);
    if (kind === "sw" && activeW[i]) {
      if (d.type === "income") d.dest_wallet_id = activeW[i].id;
      else d.source_wallet_id = activeW[i].id;
      if (d.type === "transfer" && d.dest_wallet_id === d.source_wallet_id) d.dest_wallet_id = activeW.find((w) => w.id !== d.source_wallet_id)?.id ?? null;
    }
    if (kind === "sc" && activeC[i]) d.category_id = activeC[i].id;
    await db.from("telegram_drafts").update({ draft: d as never }).eq("id", id);
    await answer();
    return edit(draftText(d, wallets, cats), draftKeyboard(id, d));
  }
  await answer();
}

// ---------- reports ----------
export async function balanceText(db: Admin, uid: string) {
  const wallets = (await dispatch<Wallet[]>(db, uid, "wallets.list")).filter((w) => !w.archived_at);
  if (!wallets.length) return "Bạn chưa có ví nào.";
  const total = wallets.reduce((s, w) => s + Number(w.balance_vnd ?? 0), 0);
  return [`<b>👛 Số dư các ví</b>`, ...wallets.map((w) => `• ${escapeHtml(w.name)}: <b>${formatVnd(Number(w.balance_vnd ?? 0))}</b>`), ``, `Tổng: <b>${formatVnd(total)}</b>`].join("\n");
}

type Range = { expense_vnd: number; income_vnd: number; count: number; all_count: number; categories: { name: string; icon: string; total_vnd: number }[] };

export async function rangeReport(db: Admin, uid: string, period: Period) {
  const { from, to } = periodRange(period);
  return dispatch<Range>(db, uid, "reports.range", { from: from.toISOString(), to: to.toISOString() });
}

export async function spendingText(db: Admin, uid: string, period: Period, withCategories: boolean, title?: string) {
  const r = await rangeReport(db, uid, period);
  const lines = [
    `<b>📊 ${title ?? PERIOD_LABEL[period]}</b>`,
    `💸 Chi: <b>${formatVnd(Number(r.expense_vnd))}</b>`,
    `💰 Thu: <b>${formatVnd(Number(r.income_vnd))}</b>`,
    `🧾 ${r.count} giao dịch`,
  ];
  if (withCategories && r.categories.length) {
    lines.push("", "<b>Chi nhiều nhất</b>", ...r.categories.slice(0, 5).map((c) => `${c.icon} ${escapeHtml(c.name)}: ${formatVnd(Number(c.total_vnd))}`));
  }
  if (period === "month" || period === "week") {
    const b = await budgetLine(db, uid);
    if (b) lines.push("", b);
  }
  return lines.join("\n");
}

async function budgetLine(db: Admin, uid: string) {
  const s = await dispatch<{ expense_vnd: number; budget_vnd: number | null }>(db, uid, "reports.summary");
  if (!s.budget_vnd) return null;
  const pct = Math.round((Number(s.expense_vnd) / Number(s.budget_vnd)) * 100);
  const left = Number(s.budget_vnd) - Number(s.expense_vnd);
  return `🎯 Ngân sách tháng: ${formatVnd(Number(s.expense_vnd))} / ${formatVnd(Number(s.budget_vnd))} (${pct}%) · ${left >= 0 ? `còn ${formatVnd(left)}` : `vượt ${formatVnd(-left)}`}`;
}

async function budgetText(db: Admin, uid: string) {
  return (await budgetLine(db, uid)) ?? "Bạn chưa đặt ngân sách cho tháng này. Đặt trong app ở trang chủ nhé.";
}

/** Sends a budget alert once per level (80%, 100%) per month. */
export async function checkBudget(db: Admin, link: Link) {
  const s = await dispatch<{ expense_vnd: number; budget_vnd: number | null }>(db, link.user_id, "reports.summary");
  const month = vnClock().monthStart;
  const level = budgetLevel(Number(s.expense_vnd), s.budget_vnd ? Number(s.budget_vnd) : null);
  const prev = link.budget_alert_month === month ? link.budget_alert_level : 0;
  if (level <= prev) {
    if (link.budget_alert_month !== month) await db.from("telegram_links").update({ budget_alert_month: month, budget_alert_level: level }).eq("user_id", link.user_id);
    return;
  }
  const pct = Math.round((Number(s.expense_vnd) / Number(s.budget_vnd)) * 100);
  const msg = level === 2
    ? `🚨 <b>Đã vượt ngân sách tháng!</b>\nĐã chi ${formatVnd(Number(s.expense_vnd))} / ${formatVnd(Number(s.budget_vnd))} (${pct}%).`
    : `⚠️ <b>Sắp chạm ngân sách tháng</b>\nĐã chi ${formatVnd(Number(s.expense_vnd))} / ${formatVnd(Number(s.budget_vnd))} (${pct}%). Còn ${formatVnd(Number(s.budget_vnd) - Number(s.expense_vnd))}.`;
  await sendMessage(link.chat_id, msg);
  await db.from("telegram_links").update({ budget_alert_month: month, budget_alert_level: level }).eq("user_id", link.user_id);
}

// ---------- notification preferences ----------
const PREFS = [
  ["budget", "notify_budget", "Cảnh báo ngân sách"],
  ["daily", "notify_daily", "Tổng kết mỗi tối (21h)"],
  ["weekly", "notify_weekly", "Tổng kết tuần (CN 21h)"],
  ["reminder", "notify_reminder", "Nhắc ghi chép (20h)"],
] as const;

async function prefsKeyboard(db: Admin, uid: string) {
  const { data } = await db.from("telegram_links").select("notify_budget, notify_daily, notify_weekly, notify_reminder").eq("user_id", uid).single();
  return { inline_keyboard: PREFS.map(([k, col, label]) => [{ text: `${data?.[col] ? "🔔" : "🔕"} ${label}`, callback_data: `nt:${k}` }]) };
}

async function sendPrefs(db: Admin, chatId: number, uid: string) {
  await sendMessage(chatId, "<b>Thông báo</b> — bấm để bật/tắt:", { reply_markup: await prefsKeyboard(db, uid) });
}

async function togglePref(db: Admin, uid: string, key: string, chatId: number, messageId: number | undefined, answer: (t?: string) => Promise<unknown>) {
  const pref = PREFS.find((p) => p[0] === key);
  if (!pref) return answer();
  const { data } = await db.from("telegram_links").select(pref[1]).eq("user_id", uid).single();
  const next = !(data as Record<string, boolean> | null)?.[pref[1]];
  await db.from("telegram_links").update({ [pref[1]]: next } as never).eq("user_id", uid);
  await answer(next ? "Đã bật" : "Đã tắt");
  if (messageId) await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: await prefsKeyboard(db, uid) }).catch(() => null);
}
