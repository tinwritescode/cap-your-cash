import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./auth";
import { monthIso, monthRange } from "./finance";

export type Wallet = Tables<"wallets">;
export type Category = Tables<"categories">;
export type Tx = Tables<"transactions">;
export type Photo = Tables<"transaction_photos">;
export type Profile = Tables<"profiles">;
export type TxWithPhotos = Tx & { transaction_photos: Photo[] };

export const qk = {
  profile: ["profile"] as const,
  wallets: ["wallets"] as const,
  balances: ["balances"] as const,
  categories: ["categories"] as const,
  month: (y: number, m: number, w?: string | null) => ["month", y, m, w ?? "all"] as const,
  monthTx: (y: number, m: number) => ["monthTx", y, m] as const,
  tx: (id: string) => ["tx", id] as const,
  list: (f: unknown) => ["txlist", f] as const,
  trash: ["trash"] as const,
  reports: (y: number, m: number) => ["reports", y, m] as const,
};

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profile,
    enabled: !!user,
    queryFn: async () =>
      must(
        await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      ) as Profile | null,
  });
}

export function useWallets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.wallets,
    enabled: !!user,
    queryFn: async () => must(await supabase.from("wallets").select("*").order("created_at")),
  });
}

export function useBalances() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.balances,
    enabled: !!user,
    queryFn: async () => {
      const rows = must(await supabase.rpc("wallet_balances"));
      return Object.fromEntries(
        (rows ?? []).map((r) => [r.wallet_id, Number(r.balance_vnd)]),
      ) as Record<string, number>;
    },
  });
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.categories,
    enabled: !!user,
    queryFn: async () => must(await supabase.from("categories").select("*").order("created_at")),
  });
}

export function useMonthSummary(y: number, m: number, wallet?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.month(y, m, wallet),
    enabled: !!user,
    queryFn: async () => {
      const rows = must(
        await supabase.rpc("month_summary", {
          p_month: monthIso(y, m),
          p_wallet: wallet ?? undefined,
        }),
      );
      const r = rows?.[0];
      return {
        expense: Number(r?.expense_vnd ?? 0),
        income: Number(r?.income_vnd ?? 0),
        allExpense: Number(r?.all_wallets_expense_vnd ?? 0),
        budget: r?.budget_vnd === null || r?.budget_vnd === undefined ? null : Number(r.budget_vnd),
      };
    },
  });
}

export function useMonthTx(y: number, m: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.monthTx(y, m),
    enabled: !!user,
    queryFn: async () => {
      const { start, end } = monthRange(y, m);
      return must(
        await supabase
          .from("transactions")
          .select("*, transaction_photos(*)")
          .is("deleted_at", null)
          .gte("occurred_at", start.toISOString())
          .lt("occurred_at", end.toISOString())
          .order("occurred_at", { ascending: false }),
      ) as TxWithPhotos[];
    },
  });
}

export function useTx(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.tx(id),
    enabled: !!user,
    queryFn: async () =>
      must(
        await supabase
          .from("transactions")
          .select("*, transaction_photos(*)")
          .eq("id", id)
          .maybeSingle(),
      ) as TxWithPhotos | null,
  });
}

/** Invalidate everything financial after a write or a realtime event. */
export function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  for (const k of [
    "wallets",
    "balances",
    "categories",
    "month",
    "monthTx",
    "tx",
    "txlist",
    "trash",
    "reports",
    "gallery",
    "profile",
  ]) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

export function useRealtimeInvalidation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`user-${user.id}`);
    for (const table of ["transactions", "wallets", "categories", "monthly_budgets", "profiles"]) {
      const filter = table === "profiles" ? `id=eq.${user.id}` : `owner_id=eq.${user.id}`;
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter }, () =>
        invalidateFinance(qc),
      );
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);
}

/** Signed URLs (short lived, memory only). */
export function useSignedUrls(paths: string[]) {
  const { user } = useAuth();
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["signed", key],
    enabled: !!user && paths.length > 0,
    staleTime: 45 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]),
      ) as Record<string, string>;
    },
  });
}

export function rpcErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const m = msg.match(/(?:VALIDATION|AUTH):(.*)$/);
  if (m) return m[1].trim();
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return "Mất kết nối mạng. Vui lòng thử lại.";
  return msg;
}

type RpcResult = { error: { message: string } | null };

async function writeRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  return supabase.rpc(name as never, args as never) as unknown as Promise<RpcResult>;
}

export const updateProfile = (patch: Record<string, unknown>) =>
  writeRpc("update_profile", { p_patch: patch });

export const createWallet = (args: {
  p_name: string;
  p_kind: string;
  p_opening_balance_vnd: number;
  p_opening_at: string;
}) => writeRpc("create_wallet", args);

export const renameWallet = (p_id: string, p_name: string) =>
  writeRpc("rename_wallet", { p_id, p_name });

export const archiveWallet = (p_id: string, p_archived: boolean) =>
  writeRpc("archive_wallet", { p_id, p_archived });

export const createCategory = (args: {
  p_name: string;
  p_icon: string;
  p_type: string;
  p_parent_id: string | null;
}) => writeRpc("create_category", args);

export const archiveCategory = (p_id: string, p_archived: boolean) =>
  writeRpc("archive_category", { p_id, p_archived });

export const upsertMonthlyBudget = (p_month: string, p_amount_vnd: number) =>
  writeRpc("upsert_monthly_budget", { p_month, p_amount_vnd });

export const deleteMonthlyBudget = (p_month: string) =>
  writeRpc("delete_monthly_budget", { p_month });
