import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mic, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseVoice, type VoiceResult } from "@/lib/voice.functions";

const TICKS = 60;
const MAX_MS = 30_000;
type Ok = Extract<VoiceResult, { ok: true }>;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

async function toBase64(b: Blob) {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Voice entry: tap to record, tap again to stop; returns parsed draft fields. Audio stays in memory only. */
export function VoiceCapture({ onResult, onClose, onCamera, onManual, kind, onKind }: {
  onResult: (r: Ok) => void;
  onClose: () => void;
  onCamera: () => void;
  onManual: () => void;
  kind: "expense" | "income";
  onKind: (k: "expense" | "income") => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [level, setLevel] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLevel(0);
  };
  useEffect(() => () => { rec.current?.state === "recording" && (rec.current.onstop = null, rec.current.stop()); cleanup(); }, []);

  async function start() {
    setError(null); setText("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v - 128)); setLevel(p / 128); raf.current = requestAnimationFrame(tick); };
      tick();
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        void ctx.close();
        cleanup();
        const blob = new Blob(chunks, { type: r.mimeType || mime || "audio/webm" });
        if (blob.size < 1500) { setState("idle"); setError("Bản ghi quá ngắn, giữ lâu hơn chút nhé."); return; }
        setState("working");
        try {
          const res = await parseVoice({ data: { audio: await toBase64(blob), mime: blob.type } });
          if (!res.ok) { setError(res.error); setState("idle"); return; }
          setText(res.text);
          onResult(res);
        } catch {
          setError("Mất kết nối mạng. Vui lòng thử lại.");
          setState("idle");
        }
      };
      rec.current = r;
      r.start();
      setState("recording");
      timer.current = setTimeout(() => r.state === "recording" && r.stop(), MAX_MS);
    } catch {
      cleanup();
      setError("Không mở được micro. Hãy cho phép quyền micro trong trình duyệt.");
    }
  }

  const toggle = () => (state === "recording" ? rec.current?.stop() : state === "idle" && void start());

  return (
    <div className="flex min-h-[86dvh] flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
      <div className="mb-5 flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onClose} aria-label="Đóng" className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"><X className="size-5" /></Button>
        <div className="grid flex-1 grid-cols-2 rounded-full bg-surface-2 p-1" role="tablist">
          {(["expense", "income"] as const).map((k) => (
            <Button key={k} type="button" variant="ghost" role="tab" aria-selected={kind === k} onClick={() => onKind(k)}
              className={cn("min-h-10 rounded-full text-sm font-medium", kind === k ? "bg-surface font-semibold" : "text-muted-foreground")}>
              {k === "expense" ? "Chi tiêu" : "Thu nhập"}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <Button type="button" variant="ghost" onClick={toggle} disabled={state === "working"} aria-label={state === "recording" ? "Dừng ghi âm" : "Bắt đầu nói"}
          className="relative grid size-72 place-items-center rounded-full">
          {Array.from({ length: TICKS }).map((_, i) => {
            const wobble = state === "recording" ? level * (0.6 + 0.4 * Math.sin(i * 1.7 + level * 9)) : 0;
            return (
              <span key={i} className={cn("absolute left-1/2 top-1/2 w-0.5 origin-bottom rounded-full transition-[height] duration-75", state === "recording" ? "bg-foreground/70" : "bg-muted-foreground/40")}
                style={{ height: `${10 + wobble * 22}px`, transform: `translate(-50%, -100%) rotate(${(i * 360) / TICKS}deg) translateY(-118px)` }} />
            );
          })}
          <span className={cn("grid size-20 place-items-center rounded-full border border-border transition-transform", state === "recording" && "scale-110")}>
            {state === "working" ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <span className={cn("size-4 rounded-full bg-expense", state === "recording" && "animate-pulse")} />}
          </span>
        </Button>
        <p className="min-h-12 max-w-xs text-center text-sm text-muted-foreground">
          {error ? <span className="text-destructive">{error}</span>
            : state === "recording" ? "Đang nghe… bấm lần nữa để dừng"
            : state === "working" ? (text || "Đang hiểu câu nói…")
            : "Bấm và nói, ví dụ “tiền nhà ba củ”, “cà phê ba chục”"}
        </p>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs">🇻🇳 Tiếng Việt</span>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-md grid-cols-3 text-xs">
        <Button type="button" variant="ghost" onClick={onManual} className="flex min-h-14 flex-col items-center justify-center gap-1 text-muted-foreground"><PenLine className="size-5" />Nhập tay</Button>
        <span className="flex min-h-14 flex-col items-center justify-center gap-1 font-semibold"><Mic className="size-5" />Giọng nói</span>
        <Button type="button" variant="ghost" onClick={onCamera} className="flex min-h-14 flex-col items-center justify-center gap-1 text-muted-foreground"><Camera className="size-5" />Hình ảnh</Button>
      </div>
    </div>
  );
}
