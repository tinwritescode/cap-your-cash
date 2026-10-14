import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCcw, X, Zap, ZapOff, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Locket-style live camera. Captures a square frame and hands it back as a File.
 * Nothing is persisted locally — the File only lives in memory until upload.
 */
export function CameraCapture({
  onCapture,
  onPickFiles,
  onSkip,
  onClose,
  title,
}: {
  onCapture: (f: File) => void;
  onPickFiles: (files: FileList | null) => void;
  onSkip: () => void;
  onClose: () => void;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<"starting" | "live" | "denied">("starting");
  const [torch, setTorch] = useState(false);
  const [flash, setFlash] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("starting");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
        setState("live");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      /* torch unsupported */
    }
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      v,
      (v.videoWidth - size) / 2,
      (v.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    c.toBlob(
      (b) => b && onCapture(new File([b], `capmoney-${Date.now()}.jpg`, { type: "image/jpeg" })),
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="flex min-h-[86dvh] flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="grid size-11 place-items-center rounded-full bg-surface-2"
        >
          <X className="size-5" />
        </button>
        <p className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={toggleTorch}
          aria-label="Đèn flash"
          disabled={state !== "live"}
          className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-40"
        >
          {torch ? <Zap className="size-5 text-primary" /> : <ZapOff className="size-5" />}
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2.5rem] bg-surface-2">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "size-full object-cover",
            facing === "user" && "-scale-x-100",
            state !== "live" && "opacity-0",
          )}
        />
        {state === "starting" && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            Đang mở camera…
          </p>
        )}
        {state === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="font-semibold">Không mở được camera</p>
            <p className="text-sm text-muted-foreground">
              Hãy cho phép quyền camera, hoặc chọn ảnh có sẵn trong thư viện.
            </p>
          </div>
        )}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-foreground transition-opacity duration-150",
            flash ? "opacity-70" : "opacity-0",
          )}
        />
      </div>

      <div className="mx-auto mt-auto flex w-full max-w-md items-center justify-between pt-8">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Chọn ảnh từ thư viện"
          className="grid size-14 place-items-center rounded-full bg-surface-2"
        >
          <ImagePlus className="size-6" />
        </button>
        <button
          type="button"
          onClick={shoot}
          disabled={state !== "live"}
          aria-label="Chụp ảnh"
          className="grid size-20 place-items-center rounded-full border-4 border-primary p-1 transition-transform active:scale-90 disabled:opacity-40"
        >
          <span className="size-full rounded-full bg-foreground" />
        </button>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Đổi camera"
          className="grid size-14 place-items-center rounded-full bg-surface-2"
        >
          <RefreshCcw className="size-6" />
        </button>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-muted-foreground"
      >
        <PenLine className="size-4" /> Ghi không cần ảnh
      </button>
      <Input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          onPickFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
