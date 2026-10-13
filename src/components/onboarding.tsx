import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import { WalletForm } from "./wallet-form";

export function Onboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function saveName() {
    if (!name.trim()) return;
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-10">
      <div>
        <h1 className="text-3xl font-bold">Chào mừng đến CapMoney 👋</h1>
        <p className="mt-2 text-muted-foreground">Chưa có dữ liệu nào. Hãy tạo ví đầu tiên để bắt đầu ghi chép.</p>
      </div>
      {!profile?.display_name && (
        <div className="rounded-3xl bg-surface p-4">
          <Label htmlFor="dn">Bạn muốn được gọi là gì?</Label>
          <div className="mt-2 flex gap-2">
            <Input id="dn" className="h-11" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị" />
            <Button className="h-11" onClick={saveName}>Lưu</Button>
          </div>
        </div>
      )}
      <div className="rounded-3xl bg-surface p-4">
        {creating ? <WalletForm /> : (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-muted-foreground">Ví là nơi chứa tiền: tiền mặt, tài khoản ngân hàng hoặc thẻ tín dụng. Số dư được tính từ số dư ban đầu và các giao dịch.</p>
            <Button className="h-12 rounded-2xl" onClick={() => setCreating(true)}>Tạo ví đầu tiên</Button>
          </div>
        )}
      </div>
    </div>
  );
}
