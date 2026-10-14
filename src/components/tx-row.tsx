import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Camera } from "lucide-react";
import type { Category, TxWithPhotos, Wallet } from "@/lib/data";
import { formatDateTime } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { PhotoThumb } from "./photo";

export function TxRow({
  tx,
  categories,
  wallets,
}: {
  tx: TxWithPhotos;
  categories: Category[];
  wallets: Wallet[];
}) {
  const cat = categories.find((c) => c.id === tx.category_id);
  const w = (id: string | null) => wallets.find((x) => x.id === id)?.name ?? "";
  const photo = tx.transaction_photos?.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
  const title =
    tx.type === "transfer"
      ? `${w(tx.source_wallet_id)} → ${w(tx.dest_wallet_id)}`
      : (cat?.name ?? (tx.type === "journal" ? "Nhật ký ảnh" : ""));
  return (
    <Link
      to="/tx/$id"
      params={{ id: tx.id }}
      className="flex min-h-14 items-center gap-3 rounded-2xl p-2 hover:bg-surface-2"
    >
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-xl">
        {photo ? (
          <PhotoThumb path={photo.thumb_path} className="size-full" />
        ) : tx.type === "transfer" ? (
          <ArrowLeftRight className="size-5" />
        ) : (
          (cat?.icon ?? <Camera className="size-5" />)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDateTime(tx.occurred_at)}
          {tx.note ? ` · ${tx.note}` : ""}
        </p>
      </div>
      {tx.type === "journal" ? (
        <span className="text-sm text-muted-foreground">0đ · Nhật ký</span>
      ) : (
        <Money
          value={Number(tx.amount_vnd)}
          sign={tx.type === "expense" ? "-" : tx.type === "income" ? "+" : undefined}
          className={
            tx.type === "expense"
              ? "font-semibold text-expense"
              : tx.type === "income"
                ? "font-semibold text-income"
                : "font-semibold"
          }
        />
      )}
    </Link>
  );
}
