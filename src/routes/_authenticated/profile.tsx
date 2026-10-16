import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SettingsRow as Row } from "@/components/settings-row";
import { TelegramLinkCard } from "@/components/telegram/telegram-link-card";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bot, Check, ChevronRight, Download, LogOut, Moon, Smartphone, Snowflake, Trash2, Eye, TriangleAlert, Volume2 } from "lucide-react";
import { ACCENTS, FONTS, accentColor, checkAccent, loadFont } from "@/lib/themes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import { CURRENCY, TIMEZONE } from "@/lib/finance";
import { usePrefs } from "@/lib/ui-prefs";
import { tutorialBus } from "@/lib/tutorial-bus";
import { useComposer } from "@/components/composer";
import { useConfirm } from "@/components/confirm";
import { PageHeader } from "@/components/shell";
import { PhotoThumb } from "@/components/photo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SoundSwitch } from "@/components/sound-switch";
import { checkFile, prepareImage } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/profile")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Cá nhân — CapMoney" },
      { name: "description", content: "Hồ sơ, giao diện, thùng rác, xuất CSV, hướng dẫn và cài đặt ứng dụng." },
      { property: "og:title", content: "Cá nhân — CapMoney" },
      { property: "og:description", content: "Hồ sơ và cài đặt CapMoney." },
    ],
  }),
  component: ProfilePage,
});

type BIP = Event & { prompt: () => Promise<void> };

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { hidden, toggle } = usePrefs();
  const { dirty } = useComposer();
  const ask = useConfirm();
  const [name, setName] = useState("");
  const [bip, setBip] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(profile?.display_name ?? ""); }, [profile?.display_name]);
  useEffect(() => { FONTS.forEach(loadFont); }, []);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  async function update(patch: { display_name?: string | null; avatar_path?: string; theme?: string; accent?: string; font?: string }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function avatar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const bad = checkFile(f);
    if (bad) return toast.error(bad);
    const { thumb } = await prepareImage(f);
    const path = `${user!.id}/avatar/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, thumb, { contentType: "image/jpeg" });
    if (error) return toast.error(error.message);
    update({ avatar_path: path });
  }
  async function logout() {
    if (dirty && !(await ask({ title: "Đăng xuất?", body: "Có nội dung chưa lưu. Đăng xuất sẽ huỷ nội dung đó.", ok: "Đăng xuất", destructive: true }))) return;
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth" });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Cá nhân" />
      <div className="flex items-center gap-4 rounded-3xl bg-surface p-4">
        <button onClick={() => fileRef.current?.click()} aria-label="Đổi ảnh đại diện" className="size-16 shrink-0 overflow-hidden rounded-full bg-surface-2">
          {profile?.avatar_path ? <PhotoThumb path={profile.avatar_path} className="size-full" /> : <span className="grid size-full place-items-center text-2xl">🙂</span>}
        </button>
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => avatar(e.target.files)} />
        <div className="flex flex-1 flex-col gap-2">
          <Input className="h-11" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Tên hiển thị" />
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Button onClick={() => update({ display_name: name.trim() || null })}>Lưu</Button>
      </div>

      <div className="flex flex-col rounded-3xl bg-surface p-2">
        <Row icon={<Eye />} label="Ẩn số tiền"><Switch checked={hidden} onCheckedChange={toggle} /></Row>
        <Row icon={<Volume2 />} label="Âm thanh khi bấm"><SoundSwitch /></Row>
        <Row icon={<Moon />} label="Giao diện tối"><Switch checked={profile?.theme !== "light"} onCheckedChange={(v) => update({ theme: v ? "dark" : "light" })} /></Row>
        <div className="px-3 py-3">
          <p className="mb-3 text-sm text-muted-foreground">Theme</p>
          <div className="grid grid-cols-5 gap-3">
            {ACCENTS.map((a) => {
              const on = (profile?.accent ?? "ocean") === a.id;
              const warn = checkAccent(a).length > 0;
              const noel = a.id === "noel";
              return (
                <button key={a.id} aria-label={a.name + (warn ? " (độ tương phản thấp)" : "")} aria-pressed={on} title={a.name} onClick={() => update({ accent: a.id })}
                  className={`relative mx-auto grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface ${on ? "ring-2 ring-foreground" : ""}`}
                  style={noel ? { background: "linear-gradient(135deg, oklch(0.55 0.2 25) 50%, oklch(0.45 0.12 150) 50%)" } : { background: accentColor(a) }}>
                  {noel ? <Snowflake className="size-4 text-background" /> : null}
                  {!noel && on && <Check className="size-4 text-background" />}
                  {warn && <span aria-hidden className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-foreground text-background text-[10px] font-bold">!</span>}
                </button>
              );
            })}
          </div>
          {(() => {
            const a = ACCENTS.find((x) => x.id === (profile?.accent ?? "ocean")) ?? ACCENTS[0];
            const issues = checkAccent(a);
            const mode = profile?.theme === "light" ? "light" : "dark";
            if (!issues.length) return <p className="mt-3 text-xs text-muted-foreground">✓ “{a.name}” dễ đọc ở cả chế độ sáng và tối.</p>;
            return (
              <div role="status" className="mt-3 rounded-2xl border border-border bg-surface-2 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4" /> “{a.name}” có thể khó đọc</p>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-muted-foreground">
                  {issues.map((i, k) => (
                    <li key={k} className={i.mode === mode ? "text-foreground" : ""}>
                      Chế độ {i.mode === "light" ? "sáng" : "tối"}{i.mode === mode ? " (đang dùng)" : ""} · {i.what}: {i.ratio.toFixed(1)}:1 (cần {i.need}:1)
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
        <div className="px-3 py-3">
          <p className="mb-2 text-sm text-muted-foreground">Phông chữ</p>
          <div className="flex flex-wrap gap-1.5">
            {FONTS.map((f) => {
              const on = (profile?.font ?? "jakarta") === f.id;
              return (
                <button key={f.id} aria-pressed={on} onClick={() => update({ font: f.id })}
                  onPointerEnter={() => loadFont(f)} onFocus={() => loadFont(f)}
                  className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-surface-2"}`}
                  style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>
        <Row to="/trash" icon={<Trash2 />} label="Thùng rác"><ChevronRight /></Row>
        <Row to="/transactions" icon={<Download />} label="Xuất CSV (trong Giao dịch)"><ChevronRight /></Row>
        <Row to="/agents" icon={<Bot />} label="Agents & API"><ChevronRight /></Row>
        <button className="contents text-left" onClick={() => tutorialBus.open()}><Row icon={<BookOpen />} label="Hướng dẫn sử dụng"><ChevronRight /></Row></button>
      </div>

      <TelegramLinkCard />

      <div className="rounded-3xl bg-surface p-4">
        <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-5" /> Cài ứng dụng</p>
        {bip ? (
          <Button className="mt-3" onClick={() => bip.prompt()}>Cài CapMoney</Button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {ios ? "Trên iPhone: mở bằng Safari, bấm nút Chia sẻ rồi chọn “Thêm vào MH chính”." : "Mở menu trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”."}
            {" "}Cài đặt không giúp dùng offline — vẫn cần internet.
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-surface p-4 text-sm text-muted-foreground">
        <p>Tiền tệ: <span className="text-foreground">{CURRENCY}</span></p>
        <p>Múi giờ: <span className="text-foreground">{TIMEZONE}</span></p>
      </div>

      <Button variant="secondary" className="h-12 rounded-2xl text-destructive" onClick={logout}><LogOut /> Đăng xuất</Button>
    </div>
  );
}
