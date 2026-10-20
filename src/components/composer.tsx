import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, X, AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth, onAccountChange } from "@/lib/auth";
import { invalidateFinance, rpcErrorMessage, useCategories, useWallets, type TxWithPhotos, type Category } from "@/lib/data";
import { fromLocalInput, parseVnd, toLocalInput, formatVnd } from "@/lib/finance";
import { checkFile, MAX_PHOTOS, prepareImage } from "@/lib/image";
import { useOnline } from "@/hooks/use-online";
import { PhotoThumb } from "./photo";
import { cn } from "@/lib/utils";
import { useConfirm } from "./confirm";
import { CameraCapture } from "./camera-capture";
import { VoiceCapture } from "./voice-capture";
import { AppSelect, DateTimePicker } from "./pickers";

type TxType = "expense" | "income" | "transfer" | "journal";
type PhotoItem = {
  id: string;
  existingThumb?: string; // thumb path of an already-saved photo
  original_path: string;
  thumb_path: string;
  blobs?: { original: Blob; thumb: Blob; preview: string };
  uploaded: boolean;
};
type Phase = "idle" | "preparing" | "uploading" | "committing" | "unknown" | "conflict";

type Ctx = { openNew: (t?: TxType) => void; openEdit: (tx: TxWithPhotos) => void; dirty: boolean };
const ComposerCtx = createContext<Ctx>({ openNew: () => {}, openEdit: () => {}, dirty: false });
export const useComposer = () => useContext(ComposerCtx);

const TYPES: { v: TxType; label: string }[] = [
  { v: "expense", label: "Chi" },
  { v: "income", label: "Thu" },
  { v: "transfer", label: "Chuyển ví" },
  { v: "journal", label: "Nhật ký ảnh" },
];

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxWithPhotos | null>(null);
  const [initialType, setInitialType] = useState<TxType>("expense");
  const [session, setSession] = useState(0);
  const [dirty, setDirty] = useState(false);

  const openNew = useCallback((t: TxType = "expense") => {
    setEditing(null);
    setInitialType(t);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);
  const openEdit = useCallback((tx: TxWithPhotos) => {
    setEditing(tx);
    setInitialType(tx.type as TxType);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  useEffect(() => { const off = onAccountChange(() => { setOpen(false); setEditing(null); setDirty(false); setSession((s) => s + 1); }); return () => { off(); }; }, []);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const ask = useConfirm();
  const close = async (force = false) => {
    if (dirty && !force && !(await ask({ title: "Bỏ nội dung chưa lưu?", body: "Nội dung này chỉ nằm trong trang và sẽ mất.", ok: "Bỏ", cancel: "Tiếp tục ghi", destructive: true }))) return;
    setOpen(false);
    setDirty(false);
  };

  return (
    <ComposerCtx.Provider value={useMemo(() => ({ openNew, openEdit, dirty }), [openNew, openEdit, dirty])}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="overflow-y-auto rounded-[2rem] border-border bg-surface p-0 sm:max-w-lg [&>button:last-child]:hidden">
          {open && (
            <TxForm key={session} editing={editing} initialType={initialType} onDirty={setDirty} onDone={() => close(true)} onCancel={() => close()} />
          )}
        </DialogContent>
      </Dialog>
    </ComposerCtx.Provider>
  );
}

function catLabel(c: Category, all: Category[]) {
  const p = c.parent_id ? all.find((x) => x.id === c.parent_id) : null;
  return `${c.icon} ${p ? `${p.name} › ` : ""}${c.name}`;
}

function TxForm({ editing, initialType, onDirty, onDone, onCancel }: { editing: TxWithPhotos | null; initialType: TxType; onDirty: (d: boolean) => void; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const online = useOnline();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState(editing ? String(editing.amount_vnd) : "");
  const [src, setSrc] = useState<string>(editing?.source_wallet_id ?? "");
  const [dst, setDst] = useState<string>(editing?.dest_wallet_id ?? "");
  const [cat, setCat] = useState<string>(editing?.category_id ?? "");
  const [when, setWhen] = useState(toLocalInput(editing?.occurred_at ?? new Date()));
  const [note, setNote] = useState(editing?.note ?? "");
  const txId = useRef<string>(editing?.id ?? crypto.randomUUID());
  const [photos, setPhotos] = useState<PhotoItem[]>(
    () =>
      editing?.transaction_photos
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ id: p.id, existingThumb: p.thumb_path, original_path: p.original_path, thumb_path: p.thumb_path, uploaded: true })) ?? [],
  );
  const [stage, setStage] = useState<"camera" | "voice" | "form">(editing ? "form" : "camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const snapshot = useRef<Record<string, unknown> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const locked = phase !== "idle";
  const usable = (id: string, current?: string | null) => wallets.filter((w) => !w.archived_at || w.id === current);

  useEffect(() => {
    const changed = !!amount || !!note || photos.some((p) => p.blobs);
    onDirty(changed && phase !== "idle" ? true : changed);
  }, [amount, note, photos, phase, onDirty]);

  // default wallet/category
  useEffect(() => {
    if (editing) return;
    const active = wallets.filter((w) => !w.archived_at);
    if (!src && active[0] && (type === "expense" || type === "transfer")) setSrc(active[0].id);
    if (!dst && active[0] && type === "income") setDst(active[0].id);
    if (type === "transfer" && active[1] && (!dst || dst === src)) setDst(active.find((w) => w.id !== (src || active[0].id))?.id ?? "");
  }, [wallets, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const catType = type === "income" ? "income" : "expense";
  const catOptions = categories.filter((c) => c.type === catType && (!c.archived_at || c.id === editing?.category_id));

  async function addFiles(list: FileList | File[] | null) {
    if (!list || !user) return;
    const files = Array.from(list);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast.error(`Tối đa ${MAX_PHOTOS} ảnh mỗi giao dịch.`);
    setPhase("preparing");
    for (const f of files.slice(0, room)) {
      const bad = checkFile(f);
      if (bad) { toast.error(bad); continue; }
      try {
        setProgress(`Đang nén ${f.name}…`);
        const blobs = await prepareImage(f);
        const id = crypto.randomUUID();
        const base = `${user.id}/${txId.current}/${id}`;
        setPhotos((p) => [...p, { id, original_path: `${base}.jpg`, thumb_path: `${base}_t.jpg`, blobs, uploaded: false }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không đọc được ảnh");
      }
    }
    setProgress("");
    setPhase("idle");
  }

  function buildPayload() {
    const amt = type === "journal" ? 0 : parseVnd(amount);
    if (type !== "journal" && (!amt || amt <= 0)) return "Nhập số tiền lớn hơn 0.";
    if ((type === "expense" || type === "transfer") && !src) return "Chọn ví nguồn.";
    if ((type === "income" || type === "transfer") && !dst) return "Chọn ví.";
    if (type === "transfer" && src === dst) return "Hai ví phải khác nhau.";
    if ((type === "expense" || type === "income") && !cat) return "Chọn danh mục.";
    if (type === "journal" && photos.length === 0) return "Nhật ký ảnh cần ít nhất một ảnh.";
    if (!when) return "Chọn thời gian.";
    return {
      p_id: txId.current,
      p_type: type,
      p_amount: amt ?? 0,
      p_source: type === "income" ? null : src || null,
      p_dest: type === "income" || type === "transfer" ? dst || null : null,
      p_category: type === "transfer" ? null : cat || null,
      p_occurred_at: fromLocalInput(when).toISOString(),
      p_note: note.trim() || null,
      p_photos: photos.map((p, i) => ({ id: p.id, original_path: p.original_path, thumb_path: p.thumb_path, sort_order: i })),
    };
  }

  async function uploadAll() {
    const pending = photos.filter((p) => !p.uploaded && p.blobs);
    let i = 0;
    for (const p of pending) {
      i++;
      setProgress(`Đang tải ảnh ${i}/${pending.length}…`);
      for (const [path, blob] of [[p.original_path, p.blobs!.original], [p.thumb_path, p.blobs!.thumb]] as const) {
        const { error } = await supabase.storage.from("photos").upload(path, blob, { upsert: false, contentType: "image/jpeg" });
        // Existing bytes are never replaced: an "already exists" on retry means this file is already there.
        if (error && !/exists|Duplicate|409/i.test(error.message)) throw new Error(`Tải ảnh thất bại: ${error.message}`);
      }
      p.uploaded = true;
      setPhotos((all) => all.map((x) => (x.id === p.id ? { ...x, uploaded: true } : x)));
    }
  }

  async function callWithRetry() {
    const payload = snapshot.current!;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const q = editing
          ? supabase.rpc("update_transaction", {
              p_id: payload.p_id as string, p_version: editing.version, p_amount: payload.p_amount as number,
              p_source: payload.p_source as string, p_dest: payload.p_dest as string, p_category: payload.p_category as string,
              p_occurred_at: payload.p_occurred_at as string, p_note: payload.p_note as string, p_photos: payload.p_photos as never,
            })
          : supabase.rpc("commit_transaction", payload as never);
        const { data, error } = await q.abortSignal(ctrl.signal);
        clearTimeout(timer);
        if (error) {
          if (/VALIDATION|AUTH|violates|check constraint/i.test(error.message)) return { kind: "invalid" as const, message: rpcErrorMessage(error) };
          lastErr = error;
        } else return { kind: "ok" as const, data: data as { status: string; message?: string } };
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt + Math.random() * 300));
    }
    return { kind: "unknown" as const, message: rpcErrorMessage(lastErr) };
  }

  async function submit() {
    setError(null);
    if (!online) { setError("Bạn đang offline. Cần internet để lưu."); return; }
    if (!snapshot.current) {
      const p = buildPayload();
      if (typeof p === "string") { setError(p); return; }
      snapshot.current = Object.freeze(p);
    }
    const ownerAtStart = user?.id;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || u.user.id !== ownerAtStart) { snapshot.current = null; setError("Tài khoản đã thay đổi. Nội dung cũ đã bị huỷ."); return; }
      setPhase("uploading");
      await uploadAll();
    } catch (e) {
      setPhase("idle");
      snapshot.current = null;
      setError(e instanceof Error ? e.message : "Tải ảnh thất bại. Thử lại.");
      return;
    }
    setPhase("committing");
    setProgress("Đang lưu lên máy chủ…");
    const r = await callWithRetry();
    setProgress("");
    if (r.kind === "invalid") {
      snapshot.current = null; // nothing was committed — allow correcting
      setPhase("idle");
      setError(r.message);
      return;
    }
    if (r.kind === "unknown") {
      setPhase("unknown");
      setError(`Chưa rõ kết quả (${r.message}). Bấm "Thử lại" để gửi lại đúng nội dung này — sẽ không tạo trùng.`);
      return;
    }
    if (r.data.status === "conflict") {
      setPhase("conflict");
      setError(r.data.message ?? "Xung đột dữ liệu. Hãy tải lại.");
      return;
    }
    invalidateFinance(qc);
    toast.success(editing ? "Đã cập nhật" : r.data.status === "duplicate" ? "Giao dịch đã được lưu trước đó" : "Đã lưu");
    photos.forEach((p) => p.blobs && URL.revokeObjectURL(p.blobs.preview));
    onDirty(false);
    onDone();
  }

  const isEditingType = !!editing;
  if (stage === "voice") {
    return (
      <>
        <DialogTitle className="sr-only">Ghi bằng giọng nói</DialogTitle>
        <DialogDescription className="sr-only">Nói khoản thu chi, app sẽ điền sẵn để bạn kiểm tra.</DialogDescription>
        <VoiceCapture kind={type === "income" ? "income" : "expense"} onKind={(k) => setType(k)} onClose={onCancel}
          onCamera={() => setStage("camera")} onManual={() => setStage("form")}
          onResult={(r) => {
            const t = r.type ?? (type === "income" ? "income" : "expense");
            setType(t);
            if (r.amount) setAmount(String(r.amount));
            if (r.categoryId) setCat(r.categoryId);
            if (r.walletId) (t === "income" ? setDst : setSrc)(r.walletId);
            setNote(r.note || r.text);
            if (r.occurredAt && !Number.isNaN(Date.parse(r.occurredAt))) setWhen(toLocalInput(r.occurredAt));
            setStage("form");
          }} />
      </>
    );
  }
  if (stage === "camera") {
    return (
      <>
        <DialogTitle className="sr-only">Chụp ảnh giao dịch</DialogTitle>
        <DialogDescription className="sr-only">Chụp ảnh rồi nhập số tiền.</DialogDescription>
        <CameraCapture title={TYPES.find((t) => t.v === type)?.label ?? "Ghi"} onClose={onCancel}
          onCapture={(f) => { setStage("form"); void addFiles([f]); }}
          onPickFiles={(l) => { if (l?.length) { setStage("form"); void addFiles(l); } }}
          onSkip={() => setStage("form")} onVoice={type === "journal" ? undefined : () => setStage("voice")} />
      </>
    );
  }
  const hero = photos[0];
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onCancel} aria-label="Đóng" className="grid size-11 place-items-center rounded-full bg-surface-2"><X className="size-5" /></button>
        {!editing && <button type="button" disabled={locked} onClick={() => setStage("camera")} className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-medium"><Camera className="size-4" /> Chụp thêm</button>}
      </div>
      {hero && (
        <div className="relative mx-auto aspect-square w-full max-w-sm shrink-0 overflow-hidden rounded-[2.5rem] bg-surface-2">
          {hero.blobs ? <img src={hero.blobs.preview} alt="" className="size-full object-cover" /> : <PhotoThumb path={hero.existingThumb!} className="size-full" />}
          {type !== "journal" && amount && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-overlay px-4 py-1.5 text-base font-bold text-overlay-foreground">{formatVnd(parseVnd(amount) ?? 0)}</span>
          )}
        </div>
      )}
      <DialogHeader>
        <DialogTitle>{editing ? "Sửa giao dịch" : "Ghi giao dịch"}</DialogTitle>
        <DialogDescription className="text-xs">Chưa lưu cho tới khi máy chủ xác nhận. Tải lại trang sẽ mất nội dung đang nhập.</DialogDescription>
      </DialogHeader>

      {!isEditingType && (
        <div className="grid min-w-0 grid-cols-4 gap-1 rounded-2xl bg-muted p-1" role="tablist">
          {TYPES.map((t) => (
            <button key={t.v} role="tab" aria-selected={type === t.v} disabled={locked}
              onClick={() => setType(t.v)}
              className={cn("min-w-0 min-h-11 overflow-hidden rounded-xl px-1 text-center text-[clamp(0.625rem,2.8vw,0.75rem)] font-medium leading-tight whitespace-nowrap transition-colors", type === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <span className="block truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      <fieldset disabled={locked} className="flex flex-col gap-4">
        {type !== "journal" ? (
          <div>
            <Label htmlFor="amt">Số tiền (VND)</Label>
            <Input id="amt" inputMode="numeric" autoFocus placeholder="0" className={cn("mt-1 h-16 rounded-2xl text-center text-3xl font-bold", type === "expense" ? "text-expense" : type === "income" ? "text-income" : "")}
              value={amount ? (parseVnd(amount) ?? 0).toLocaleString("en-US") : ""} onChange={(e) => setAmount(e.target.value)} />
          </div>
        ) : (
          <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">Nhật ký ảnh luôn là 0đ và không ảnh hưởng số dư, thu chi hay ngân sách.</p>
        )}

        {(type === "expense" || type === "transfer" || type === "journal") && (
          <Field label={type === "transfer" ? "Từ ví" : type === "journal" ? "Ví (tuỳ chọn)" : "Ví"}>
            <AppSelect value={src} onChange={setSrc} placeholder="— Chọn ví —"
              options={[...(type === "journal" ? [{ value: "", label: "— Không chọn —" }] : []), ...usable("src", editing?.source_wallet_id).map((w) => ({ value: w.id, label: `${w.name}${w.archived_at ? " (đã lưu trữ)" : ""}` }))]} />
          </Field>
        )}
        {(type === "income" || type === "transfer") && (
          <Field label={type === "transfer" ? "Đến ví" : "Ví nhận"}>
            <AppSelect value={dst} onChange={setDst} placeholder="— Chọn ví —"
              options={usable("dst", editing?.dest_wallet_id).map((w) => ({ value: w.id, label: `${w.name}${w.archived_at ? " (đã lưu trữ)" : ""}` }))} />
          </Field>
        )}
        {type !== "transfer" && (
          <Field label={type === "journal" ? "Danh mục (tuỳ chọn)" : "Danh mục"}>
            <AppSelect value={cat} onChange={setCat} placeholder="— Chọn danh mục —"
              options={[...(type === "journal" ? [{ value: "", label: "— Không chọn —" }] : []), ...catOptions.filter((c) => !c.parent_id).flatMap((p) => [p, ...catOptions.filter((c) => c.parent_id === p.id)]).map((c) => ({ value: c.id, label: catLabel(c, categories) }))]} />
          </Field>
        )}
        <Field label="Thời gian">
          <DateTimePicker value={when} onChange={setWhen} />
        </Field>
        <Field label="Ghi chú">
          <Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Cơm trưa với đồng nghiệp" />
        </Field>

        <div>
          <Label>Ảnh {type === "journal" ? "(bắt buộc)" : "(tuỳ chọn)"} · {photos.length}/{MAX_PHOTOS}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative size-20 overflow-hidden rounded-xl bg-muted">
                {p.blobs ? <img src={p.blobs.preview} alt="" className="size-full object-cover" /> : <PhotoThumb path={p.existingThumb!} className="size-full" />}
                {!p.uploaded && phase === "uploading" && <div className="absolute inset-0 grid place-items-center bg-overlay"><Loader2 className="size-5 animate-spin text-overlay-foreground" /></div>}
                <button type="button" aria-label="Bỏ ảnh" onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-overlay text-overlay-foreground"><X className="size-4" /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <button type="button" onClick={() => camRef.current?.click()} className="grid size-20 place-items-center rounded-xl border border-dashed text-muted-foreground" aria-label="Chụp ảnh"><Camera /></button>
                <button type="button" onClick={() => fileRef.current?.click()} className="grid size-20 place-items-center rounded-xl border border-dashed text-muted-foreground" aria-label="Chọn ảnh"><ImagePlus /></button>
              </>
            )}
          </div>
          <input ref={camRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP · tối đa 10 MB/ảnh. Nếu máy không mở được camera, hãy chọn ảnh từ thư viện.</p>
        </div>
      </fieldset>

      {progress && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{progress}</p>}
      {error && (
        <div role="alert" className="flex gap-2 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        {phase === "unknown" ? (
          <Button size="lg" className="h-12 flex-1 rounded-2xl" onClick={submit} disabled={!online}><RotateCw /> Thử lại cùng nội dung</Button>
        ) : phase === "conflict" ? (
          <Button size="lg" variant="secondary" className="h-12 flex-1 rounded-2xl" onClick={() => { invalidateFinance(qc); onDone(); }}>Đóng và tải lại</Button>
        ) : (
          <Button size="lg" className="h-12 flex-1 rounded-2xl" onClick={submit} disabled={locked || !online}>
            {locked ? <Loader2 className="animate-spin" /> : null}
            {editing ? "Lưu thay đổi" : type === "journal" ? "Lưu nhật ký" : `Lưu ${amount ? formatVnd(parseVnd(amount) ?? 0) : ""}`}
          </Button>
        )}
      </div>
      {!online && <p className="text-center text-xs text-muted-foreground">Không có internet — không thể lưu.</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
