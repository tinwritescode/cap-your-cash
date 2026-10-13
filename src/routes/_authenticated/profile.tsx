import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Download, LogOut, Moon, Smartphone, Trash2, Eye } from "lucide-react";
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
import { checkFile, prepareImage } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/profile")({
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
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  async function update(patch: { display_name?: string | null; avatar_path?: string; theme?: string }) {
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
        <Row icon={<Moon />} label="Giao diện tối"><Switch checked={profile?.theme !== "light"} onCheckedChange={(v) => update({ theme: v ? "dark" : "light" })} /></Row>
        <Link to="/trash" className="contents"><Row icon={<Trash2 />} label="Thùng rác"><ChevronRight /></Row></Link>
        <Link to="/transactions" className="contents"><Row icon={<Download />} label="Xuất CSV (trong Giao dịch)"><ChevronRight /></Row></Link>
        <button className="contents text-left" onClick={() => tutorialBus.open()}><Row icon={<BookOpen />} label="Hướng dẫn sử dụng"><ChevronRight /></Row></button>
      </div>

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

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl px-3 hover:bg-surface-2">
      <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
      <span className="flex-1">{label}</span>
      {children}
    </div>
  );
}
