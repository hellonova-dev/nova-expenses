"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayName as getDisplay, MemberLike } from "@/lib/i18n";
import { Group, GroupMember, SharedExpense, ExpenseSplit, Settlement, Category } from "@/lib/types";
import Link from "next/link";
import InitialsAvatar from "@/components/InitialsAvatar";
import BottomNav from "@/components/BottomNav";

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

type ActivityItem = {
  id: string;
  type: "expense" | "settlement";
  date: string;
  groupName: string;
  groupEmoji: string;
  categoryEmoji: string;
  description: string;
};

type CurrencyBalance = { currency: string; amount: number };

type GroupWithData = Group & {
  members: GroupMember[];
  balance: number;
  currency: string;
  balances: CurrencyBalance[];
};

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang, displayName } = useLanguage();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    const [groupsRes, allMembersRes, expensesRes, settlementsRes, catsRes, profilesRes] = await Promise.all([
      supabase.from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false }),
      supabase.from("group_members").select("*").in("group_id", groupIds),
      supabase.from("shared_expenses").select("*").in("group_id", groupIds),
      supabase.from("settlements").select("*").in("group_id", groupIds),
      supabase.from("categories").select("*"),
      supabase.from("profiles").select("id, display_name"),
    ]);

    const allMembers: GroupMember[] = allMembersRes.data || [];
    const allExpenses: SharedExpense[] = expensesRes.data || [];
    const allSettlements: Settlement[] = settlementsRes.data || [];
    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));

    // Enrich members with display_name
    const enrichedMembers = allMembers.map(m => ({ ...m, display_name: profileMap[m.user_id] || null }));

    const expenseIds = allExpenses.map((e) => e.id);
    let allSplits: ExpenseSplit[] = [];
    if (expenseIds.length > 0) {
      const { data } = await supabase.from("expense_splits").select("*").in("shared_expense_id", expenseIds);
      allSplits = data || [];
    }

    const enriched: GroupWithData[] = (groupsRes.data || []).map((g) => {
      const gMembers = enrichedMembers.filter((m) => m.group_id === g.id);
      const gExpenses = allExpenses.filter((e) => e.group_id === g.id);
      const gExpenseIds = gExpenses.map((e) => e.id);
      const gSplits = allSplits.filter((s) => gExpenseIds.includes(s.shared_expense_id));
      const gSettlements = allSettlements.filter((s) => s.group_id === g.id);

      const mainCurrency = gExpenses.length > 0 ? gExpenses[0].currency : "CLP";
      const balByCurrency: Record<string, number> = {};

      for (const exp of gExpenses) {
        const cur = exp.currency || mainCurrency;
        if (!balByCurrency[cur]) balByCurrency[cur] = 0;
        if (exp.paid_by === user.id) {
          const otherSplits = gSplits.filter(
            (s) => s.shared_expense_id === exp.id && s.user_id !== user.id && !s.settled
          );
          balByCurrency[cur] += otherSplits.reduce((sum, s) => sum + Number(s.amount), 0);
        } else {
          const yourSplits = gSplits.filter(
            (s) => s.shared_expense_id === exp.id && s.user_id === user.id && !s.settled
          );
          balByCurrency[cur] -= yourSplits.reduce((sum, s) => sum + Number(s.amount), 0);
        }
      }

      for (const s of gSettlements) {
        const cur = s.currency || mainCurrency;
        if (!balByCurrency[cur]) balByCurrency[cur] = 0;
        if (s.paid_by === user.id) balByCurrency[cur] += Number(s.amount);
        if (s.paid_to === user.id) balByCurrency[cur] -= Number(s.amount);
      }

      const balancesArr: CurrencyBalance[] = Object.entries(balByCurrency).map(([currency, amount]) => ({ currency, amount }));
      const balance = balByCurrency[mainCurrency] || 0;

      return { ...g, members: gMembers, balance, currency: mainCurrency, balances: balancesArr };
    });

    setGroups(enriched);

    const catMap = Object.fromEntries((catsRes.data || []).map((c: Category) => [c.id, c]));
    const groupMap = Object.fromEntries((groupsRes.data || []).map((g: Group) => [g.id, g]));
    const memberMap = Object.fromEntries(enrichedMembers.map((m) => [m.user_id, m as MemberLike]));

    const activity: ActivityItem[] = [
      ...allExpenses.map((e): ActivityItem => {
        const cat = e.category_id ? catMap[e.category_id] : null;
        const g = groupMap[e.group_id];
        const payerName = getDisplay(memberMap[e.paid_by], user.id, lang);
        return {
          id: `e-${e.id}`, type: "expense", date: e.date || e.created_at,
          groupName: g?.name || "Group", groupEmoji: g?.emoji || "👥",
          categoryEmoji: cat?.emoji || "💰",
          description: t("paid_for", { name: payerName, amount: formatAmount(e.amount, e.currency), expense: e.name }),
        };
      }),
      ...allSettlements.map((s): ActivityItem => {
        const g = groupMap[s.group_id];
        const fromName = getDisplay(memberMap[s.paid_by], user.id, lang);
        const toName = getDisplay(memberMap[s.paid_to], user.id, lang);
        return {
          id: `s-${s.id}`, type: "settlement", date: s.created_at,
          groupName: g?.name || "Group", groupEmoji: g?.emoji || "👥",
          categoryEmoji: "💸",
          description: t("settled_with", { name: fromName, amount: formatAmount(s.amount, s.currency), other: toName }),
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

    setRecentActivity(activity);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  // Group totals by currency
  const owedByCurrency: Record<string, number> = {};
  const oweByCurrency: Record<string, number> = {};
  for (const g of groups) {
    for (const b of g.balances) {
      if (b.amount > 0) owedByCurrency[b.currency] = (owedByCurrency[b.currency] || 0) + b.amount;
      if (b.amount < 0) oweByCurrency[b.currency] = (oweByCurrency[b.currency] || 0) + Math.abs(b.amount);
    }
  }
  const hasAnyBalance = Object.keys(owedByCurrency).length > 0 || Object.keys(oweByCurrency).length > 0;
  const firstName = displayName || user.email?.split("@")[0] || "there";

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("welcome_back", { name: firstName })}</h1>
        <div className="mt-2 flex flex-wrap gap-4">
          {Object.entries(owedByCurrency).map(([cur, amt]) => (
            <span key={`owed-${cur}`} className="text-sm font-medium text-emerald-600">{t("youre_owed", { amount: formatAmount(amt, cur) })}</span>
          ))}
          {Object.entries(oweByCurrency).map(([cur, amt]) => (
            <span key={`owe-${cur}`} className="text-sm font-medium text-red-500">{t("you_owe", { amount: formatAmount(amt, cur) })}</span>
          ))}
          {!hasAnyBalance && (
            <span className="text-sm text-gray-400">{t("all_settled")}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t("loading")}</div>
      ) : (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-6xl mb-4">💸</p>
              <h2 className="text-xl font-bold text-gray-800 mb-2">{t("welcome_new_user")}</h2>
              <p className="text-gray-500 mb-6 px-4">{t("onboarding_text")}</p>
              <button
                onClick={() => router.push("/groups/new")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 transition-all"
              >
                {t("create_group")}
              </button>
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => router.push(`/groups/${g.id}`)}
                className="w-full bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 text-left hover:border-violet-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{g.emoji || "👥"}</span>
                    <p className="font-semibold text-gray-800">{g.name}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    {g.balances.filter(b => Math.abs(b.amount) > 0.01).length === 0 ? (
                      <span className="text-sm font-bold text-gray-400">{t("settled")}</span>
                    ) : (
                      g.balances.filter(b => Math.abs(b.amount) > 0.01).map(b => (
                        <span key={b.currency} className={`text-sm font-bold ${b.amount > 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {b.amount > 0 ? `+${formatAmount(b.amount, b.currency)}` : `-${formatAmount(Math.abs(b.amount), b.currency)}`}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {g.members.slice(0, 5).map((m) => (
                    <InitialsAvatar key={m.id} email={m.email} />
                  ))}
                  {g.members.length > 5 && (
                    <span className="text-xs text-gray-400 ml-1">+{g.members.length - 5}</span>
                  )}
                </div>
              </button>
            ))
          )}

          <button
            onClick={() => router.push("/groups/new")}
            className="w-full bg-violet-50 rounded-xl px-5 py-4 border-2 border-dashed border-violet-200 text-center hover:bg-violet-100 hover:border-violet-300 transition-all"
          >
            <span className="text-violet-600 font-semibold">{t("create_group")}</span>
          </button>
        </div>
      )}

      {!loading && recentActivity.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t("recent_activity")}</h2>
            <Link href="/activity" className="text-xs text-violet-500 font-medium">{t("see_all")}</Link>
          </div>
          <div className="space-y-2">
            {recentActivity.map((item) => (
              <div key={item.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.categoryEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">{item.description}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500 mt-1">
                      {item.groupEmoji} {item.groupName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => router.push("/add")}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-300 transition-all text-3xl font-light z-40"
        style={{ maxWidth: "calc(50% + 14rem)", right: "max(1rem, calc(50% - 14rem + 1rem))" }}
      >
        +
      </button>

      <BottomNav />
    </main>
  );
}
