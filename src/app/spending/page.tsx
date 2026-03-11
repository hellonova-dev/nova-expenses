"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateCategory } from "@/lib/i18n";
import { Category, Group } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

const CATEGORY_BAR_COLORS: Record<string, string> = {
  food: "bg-amber-400", rent: "bg-blue-400", utilities: "bg-yellow-400",
  transport: "bg-cyan-400", entertainment: "bg-purple-400", shopping: "bg-pink-400",
  health: "bg-emerald-400", travel: "bg-indigo-400", groceries: "bg-green-400",
  other: "bg-gray-400",
};

function getBarColor(name?: string) {
  if (!name) return "bg-gray-400";
  return CATEGORY_BAR_COLORS[name.toLowerCase()] || "bg-violet-400";
}

function formatAmount(amount: number, currency: string = "CLP") {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

type Period = "week" | "month" | "last";

function getPeriodRange(period: Period, lang: string = "en"): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = today.getDay();
    // Monday start for es, Sunday start for en
    const weekStartsMonday = lang === "es";
    const offset = weekStartsMonday ? (day === 0 ? 6 : day - 1) : day;
    const start = new Date(today); start.setDate(today.getDate() - offset);
    return { start, end: now };
  }
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start: s, end: e };
}

type CatSpend = { emoji: string; name: string; amount: number; currency: string };
type GroupSpend = { emoji: string; name: string; amount: number; currency: string };
type CurrencyTotal = { currency: string; total: number; dailyAvg: number };

export default function SpendingPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");
  const [currencyTotals, setCurrencyTotals] = useState<CurrencyTotal[]>([]);
  const [byCategory, setByCategory] = useState<CatSpend[]>([]);
  const [byGroup, setByGroup] = useState<GroupSpend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { start, end } = getPeriodRange(period, lang);

    const { data: memberships } = await supabase
      .from("group_members").select("group_id").eq("user_id", user.id);
    if (!memberships?.length) {
      setCurrencyTotals([]); setByCategory([]); setByGroup([]); setLoading(false); return;
    }
    const groupIds = memberships.map((m) => m.group_id);

    const { data: expenses } = await supabase
      .from("shared_expenses").select("*")
      .in("group_id", groupIds)
      .gte("date", start.toISOString().split("T")[0])
      .lte("date", end.toISOString().split("T")[0]);

    if (!expenses?.length) {
      setCurrencyTotals([]); setByCategory([]); setByGroup([]); setLoading(false); return;
    }

    const expenseIds = expenses.map((e) => e.id);
    const { data: splits } = await supabase
      .from("expense_splits").select("*")
      .in("shared_expense_id", expenseIds)
      .eq("user_id", user.id);

    const splitMap = Object.fromEntries((splits || []).map((s) => [s.shared_expense_id, Number(s.amount)]));

    const [catsRes, groupsRes] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("groups").select("*").in("id", groupIds),
    ]);
    const catMap = Object.fromEntries((catsRes.data || []).map((c: Category) => [c.id, c]));
    const groupMap = Object.fromEntries((groupsRes.data || []).map((g: Group) => [g.id, g]));

    const totalsByCurrency: Record<string, number> = {};
    const catTotals: Record<string, { emoji: string; name: string; amount: number; currency: string }> = {};
    const grpTotals: Record<string, { emoji: string; name: string; amount: number; currency: string }> = {};

    for (const exp of expenses) {
      const myShare = splitMap[exp.id];
      if (myShare === undefined) continue;
      const cur = exp.currency || "CLP";
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + myShare;

      const cat = exp.category_id ? catMap[exp.category_id] : null;
      const catKey = `${cat?.name || "Other"}_${cur}`;
      if (!catTotals[catKey]) catTotals[catKey] = { emoji: cat?.emoji || "💰", name: cat?.name || "Other", amount: 0, currency: cur };
      catTotals[catKey].amount += myShare;

      const grp = groupMap[exp.group_id];
      const grpKey = `${grp?.name || "Unknown"}_${cur}`;
      if (!grpTotals[grpKey]) grpTotals[grpKey] = { emoji: grp?.emoji || "👥", name: grp?.name || "Unknown", amount: 0, currency: cur };
      grpTotals[grpKey].amount += myShare;
    }

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    setCurrencyTotals(Object.entries(totalsByCurrency).map(([currency, total]) => ({ currency, total, dailyAvg: total / days })));
    setByCategory(Object.values(catTotals).sort((a, b) => b.amount - a.amount));
    setByGroup(Object.values(grpTotals).sort((a, b) => b.amount - a.amount));
    setLoading(false);
  }, [user, period, lang]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  const hasData = currencyTotals.length > 0;
  const maxCat = byCategory.length ? byCategory[0].amount : 1;
  const maxGrp = byGroup.length ? byGroup[0].amount : 1;

  const periods: { key: Period; labelKey: string }[] = [
    { key: "week", labelKey: "this_week" },
    { key: "month", labelKey: "this_month" },
    { key: "last", labelKey: "last_month" },
  ];

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{t("spending")}</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              period === p.key ? "bg-white text-violet-600 shadow-sm" : "text-gray-500"
            }`}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t("loading")}</div>
      ) : !hasData ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium">{t("no_spending")}</p>
          <p className="text-sm mt-1">{t("no_spending_desc")}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4 text-center">
            <p className="text-sm text-gray-500 mb-1">{t("total_spent")}</p>
            {currencyTotals.map(ct => (
              <div key={ct.currency}>
                <p className="text-3xl font-bold text-gray-900">{formatAmount(ct.total, ct.currency)}</p>
                <p className="text-sm text-gray-400 mt-1">{t("daily_avg", { amount: formatAmount(ct.dailyAvg, ct.currency) })}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{t("by_category")}</h2>
            <div className="space-y-3">
              {byCategory.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{c.emoji} {translateCategory(c.name, lang)}</span>
                    <span className="text-sm font-medium text-gray-800">{formatAmount(c.amount, c.currency)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getBarColor(c.name)}`}
                      style={{ width: `${Math.max(4, (c.amount / maxCat) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{t("by_group")}</h2>
            <div className="space-y-3">
              {byGroup.map((g) => (
                <div key={g.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{g.emoji} {g.name}</span>
                    <span className="text-sm font-medium text-gray-800">{formatAmount(g.amount, g.currency)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{ width: `${Math.max(4, (g.amount / maxGrp) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
