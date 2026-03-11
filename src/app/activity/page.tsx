"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayName as getDisplay, MemberLike } from "@/lib/i18n";
import { SharedExpense, Settlement, Group, GroupMember, Category } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

const CATEGORY_COLORS: Record<string, string> = {
  food: "border-amber-400", rent: "border-blue-400", utilities: "border-yellow-400",
  transport: "border-cyan-400", entertainment: "border-purple-400", shopping: "border-pink-400",
  health: "border-emerald-400", travel: "border-indigo-400", groceries: "border-green-400",
  other: "border-gray-400",
};

function getCategoryBorder(name?: string) {
  if (!name) return "border-gray-300";
  return CATEGORY_COLORS[name.toLowerCase()] || "border-gray-300";
}

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

function relativeDateKey(dateStr: string): string {
  const parts = dateStr.split("T")[0].split("-");
  const target = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff < -1) return "later";
  if (diff === -1) return "tomorrow";
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "this_week";
  return "earlier";
}

type ActivityItem = {
  id: string;
  type: "expense" | "settlement";
  date: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  categoryEmoji: string;
  categoryName: string;
  description: string;
  amount: number;
  currency: string;
};

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchActivity = useCallback(async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("group_members").select("group_id").eq("user_id", user.id);
    if (!memberships?.length) { setItems([]); setLoading(false); return; }

    const groupIds = memberships.map((m) => m.group_id);

    const [groupsRes, membersRes, expensesRes, settlementsRes, catsRes, profilesRes] = await Promise.all([
      supabase.from("groups").select("*").in("id", groupIds),
      supabase.from("group_members").select("*").in("group_id", groupIds),
      supabase.from("shared_expenses").select("*").in("group_id", groupIds).order("date", { ascending: false }).limit(100),
      supabase.from("settlements").select("*").in("group_id", groupIds).order("created_at", { ascending: false }).limit(100),
      supabase.from("categories").select("*"),
      supabase.from("profiles").select("id, display_name"),
    ]);

    const groups: Group[] = groupsRes.data || [];
    const members: GroupMember[] = membersRes.data || [];
    const expenses: SharedExpense[] = expensesRes.data || [];
    const settlements: Settlement[] = settlementsRes.data || [];
    const categories: Category[] = catsRes.data || [];
    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));

    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));
    const memberMap = Object.fromEntries(members.map((m) => [m.user_id, { ...m, display_name: profileMap[m.user_id] || null } as MemberLike]));
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const activityItems: ActivityItem[] = [
      ...expenses.map((e): ActivityItem => {
        const cat = e.category_id ? catMap[e.category_id] : null;
        const g = groupMap[e.group_id];
        const payerName = getDisplay(memberMap[e.paid_by], user.id, lang);
        return {
          id: `e-${e.id}`, type: "expense", date: e.date || e.created_at,
          groupId: e.group_id, groupName: g?.name || "Group", groupEmoji: g?.emoji || "👥",
          categoryEmoji: cat?.emoji || "💰", categoryName: cat?.name || "other",
          description: t("paid_for", { name: payerName, amount: formatAmount(e.amount, e.currency), expense: e.name }),
          amount: e.amount, currency: e.currency,
        };
      }),
      ...settlements.map((s): ActivityItem => {
        const g = groupMap[s.group_id];
        const fromName = getDisplay(memberMap[s.paid_by], user.id, lang);
        const toName = getDisplay(memberMap[s.paid_to], user.id, lang);
        return {
          id: `s-${s.id}`, type: "settlement", date: s.created_at,
          groupId: s.group_id, groupName: g?.name || "Group", groupEmoji: g?.emoji || "👥",
          categoryEmoji: "💸", categoryName: "settlement",
          description: t("settled_with", { name: fromName, amount: formatAmount(s.amount, s.currency), other: toName }),
          amount: s.amount, currency: s.currency,
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setItems(activityItems);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  const grouped: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const label = relativeDateKey(item.date);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  }
  const sectionKeys = ["later", "tomorrow", "today", "yesterday", "this_week", "earlier"].filter((s) => grouped[s]);

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("activity")}</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t("loading")}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">{t("no_activity")}</p>
          <p className="text-sm mt-1">{t("no_activity_desc")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sectionKeys.map((sectionKey) => (
            <div key={sectionKey}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t(sectionKey)}</h2>
              <div className="space-y-2">
                {grouped[sectionKey].map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 border-l-4 ${getCategoryBorder(item.categoryName)} cursor-pointer hover:shadow-md transition-all`}
                    onClick={() => router.push(`/groups/${item.groupId}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-xl mt-0.5">{item.categoryEmoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500">
                              {item.groupEmoji} {item.groupName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
