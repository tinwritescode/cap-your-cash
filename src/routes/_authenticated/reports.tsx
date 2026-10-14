import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategories, useMonthSummary } from "@/lib/data";
import { formatVnd, monthIso, toLocal } from "@/lib/finance";
import { Money } from "@/lib/ui-prefs";
import { PageHeader } from "@/components/shell";

export const Route = createFileRoute("/_authenticated/reports")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Báo cáo — CapMoney" },
      { name: "description", content: "Chi tiêu theo danh mục, thu so với chi và xu hướng chi hằng ngày." },
      { property: "og:title", content: "Báo cáo — CapMoney" },
      { property: "og:description", content: "Báo cáo thu chi hằng tháng." },
    ],
  }),
  component: Reports,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const { user } = useAuth();
  const now = toLocal(new Date());
  const [ym, setYm] = useState({ y: now.y, m: now.m });
  const { data: cats = [] } = useCategories();
  const summary = useMonthSummary(ym.y, ym.m);
  const byCat = useQuery({
    queryKey: ["reports", ym.y, ym.m, "cat"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("month_category_expense", { p_month: monthIso(ym.y, ym.m) });
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.category_id, total: Number(r.total_vnd) }));
    },
  });
  const daily = useQuery({
    queryKey: ["reports", ym.y, ym.m, "daily"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("month_daily", { p_month: monthIso(ym.y, ym.m) });
      if (error) throw error;
      return (data ?? []).map((r) => ({ day: Number(String(r.day).slice(8, 10)), expense: Number(r.expense_vnd), income: Number(r.income_vnd) }));
    },
  });
  const shift = (d: number) => setYm(({ y, m }) => { const t = y * 12 + (m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const catRows = (byCat.data ?? []).map((r) => { const c = cats.find((x) => x.id === r.id); return { name: c ? `${c.icon} ${c.name}` : "?", total: r.total }; });
  const exp = summary.data?.expense ?? 0, inc = summary.data?.income ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Báo cáo" />
      <div className="flex items-center rounded-2xl bg-surface p-1">
        <button aria-label="Tháng trước" onClick={() => shift(-1)} className="grid size-11 place-items-center text-primary"><ChevronLeft /></button>
        <p className="flex-1 text-center font-semibold">tháng {ym.m} {ym.y}</p>
        <button aria-label="Tháng sau" onClick={() => shift(1)} className="grid size-11 place-items-center text-primary"><ChevronRight /></button>
      </div>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="mb-3 font-semibold">Thu so với chi</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs text-muted-foreground">Thu</p><Money value={inc} className="font-bold text-income" /></div>
          <div><p className="text-xs text-muted-foreground">Chi</p><Money value={exp} className="font-bold text-expense" /></div>
          <div><p className="text-xs text-muted-foreground">Chênh lệch</p><Money value={inc - exp} className="font-bold" /></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Không tính chuyển ví, số dư ban đầu và nhật ký ảnh.</p>
      </section>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="mb-3 font-semibold">Chi theo danh mục</h2>
        {catRows.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có khoản chi trong tháng.</p> : (
          <>
            <div className="h-56" aria-hidden>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catRows} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90} stroke="none">
                    {catRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP} formatter={(v: number) => formatVnd(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">Chi theo danh mục</caption>
              <tbody>
                {catRows.map((r, i) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-2"><span className="mr-2 inline-block size-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{r.name}</td>
                    <td className="py-2 text-right"><Money value={r.total} /></td>
                    <td className="w-14 py-2 text-right text-muted-foreground">{exp ? Math.round((r.total / exp) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="mb-3 font-semibold">Chi tiêu hằng ngày</h2>
        {!(daily.data ?? []).some((d) => d.expense > 0 || d.income > 0) ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 px-4 py-8 text-center">
            <BarChart3 className="size-7 text-muted-foreground" />
            <p className="text-sm font-medium">Chưa có thu chi trong tháng này</p>
            <p className="text-xs text-muted-foreground">Biểu đồ sẽ hiện khi bạn ghi giao dịch.</p>
          </div>
        ) : (<>
        <div className="h-48" aria-hidden>
          <ResponsiveContainer>
            <BarChart data={daily.data ?? []}>
              <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TOOLTIP} formatter={(v: number) => [formatVnd(v), "Chi"]} labelFormatter={(d) => `Ngày ${d}`} />
              <Bar dataKey="expense" name="Chi" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-primary">Xem bảng số liệu</summary>
          <table className="mt-2 w-full">
            <thead><tr className="text-muted-foreground"><th className="text-left">Ngày</th><th className="text-right">Chi</th><th className="text-right">Thu</th></tr></thead>
            <tbody>{(daily.data ?? []).filter((d) => d.expense > 0 || d.income > 0).map((d) => <tr key={d.day} className="border-t"><td className="py-1">{d.day}/{ym.m}</td><td className="text-right"><Money value={d.expense} /></td><td className="text-right"><Money value={d.income} /></td></tr>)}</tbody>
          </table>
        </details>
        </>)}
      </section>
    </div>
  );
}
