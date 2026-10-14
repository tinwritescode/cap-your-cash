import { useEffect, useState } from "react";
import { Wallet, Receipt, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Wallet,
    title: "Tạo ví của bạn",
    body: "Ví có thể là Tiền mặt, Ngân hàng hoặc Thẻ tín dụng. Nhập số dư ban đầu và ngày bắt đầu — việc theo dõi tính từ ngày đó. Tạo ví không kết nối tài khoản ngân hàng.",
    demo: (
      <div className="rounded-2xl bg-surface-2 p-4 text-left text-sm">
        <p className="text-xs text-muted-foreground">Ví dụ</p>
        <p className="font-semibold">💳 Ngân hàng · 5,000,000đ</p>
        <p className="text-xs text-muted-foreground">Bắt đầu từ 01/07</p>
      </div>
    ),
  },
  {
    icon: Receipt,
    title: "Ghi lại một khoản chi",
    body: "Nhập số tiền, chọn ví, danh mục và thời gian; thêm ảnh nếu muốn. “Nhật ký ảnh” là kỷ niệm 0đ — khác với khoản chi và không làm thay đổi số dư hay tổng thu chi.",
    demo: (
      <div className="rounded-2xl bg-surface-2 p-4 text-left text-sm">
        <p className="text-xs text-muted-foreground">Ví dụ</p>
        <p className="font-semibold text-expense">-45,000đ · 🍜 Ăn uống</p>
        <p className="text-xs text-muted-foreground">0đ · Nhật ký — không tính vào chi tiêu</p>
      </div>
    ),
  },
  {
    icon: CalendarDays,
    title: "Xem tiền đi đâu",
    body: "Lịch ảnh cho thấy mỗi ngày bạn đã chi gì; chạm vào ảnh để xem chi tiết. Đặt ngân sách tháng để được cảnh báo khi chi vượt. Mọi tính năng tài chính cần internet.",
    demo: (
      <div className="rounded-2xl bg-surface-2 p-4 text-left text-sm">
        <p className="text-xs text-muted-foreground">Ví dụ</p>
        <div className="mt-1 h-2 rounded-full bg-muted">
          <div className="h-2 w-3/4 rounded-full bg-primary" />
        </div>
        <p className="mt-1 text-xs">Còn lại 1,200,000đ · Mỗi ngày 80,000đ</p>
      </div>
    ),
  },
];

export function Tutorial({
  open,
  onFinish,
}: {
  open: boolean;
  onFinish: (result: "completed" | "dismissed") => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (open) setI(0);
  }, [open]);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onFinish("dismissed")}>
      <DialogContent
        className="rounded-3xl bg-surface sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && !last) setI(i + 1);
          if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
        }}
      >
        <p className="text-xs text-muted-foreground">
          Bước {i + 1}/{STEPS.length}
        </p>
        <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <s.icon />
        </div>
        <DialogTitle className="text-xl">{s.title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{s.body}</DialogDescription>
        {s.demo}
        <div className="mt-2 flex items-center gap-2">
          <Button variant="ghost" onClick={() => onFinish("dismissed")}>
            Bỏ qua
          </Button>
          <div className="flex-1" />
          {i > 0 && (
            <Button variant="secondary" onClick={() => setI(i - 1)}>
              Quay lại
            </Button>
          )}
          {last ? (
            <Button onClick={() => onFinish("completed")}>Bắt đầu</Button>
          ) : (
            <Button onClick={() => setI(i + 1)}>Tiếp theo</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
