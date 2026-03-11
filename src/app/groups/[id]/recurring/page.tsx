"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayName as getDisplay, MemberLike } from "@/lib/i18n";
import { GroupMember, Category, RecurringExpense } from "@/lib/types";
import InitialsAvatar from "@/components/InitialsAvatar";
import BottomNav from "@/components/BottomNav";

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

export default function RecurringExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [members, setMembers] = useState<(GroupMember & { display_name?: string | null })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"CLP" | "USD">("CLP");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;

    const [membersRes, categoriesRes, recurringRes, profilesRes] = await Promise.all([
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("categories").select("*"),
      supabase.from("recurring_expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);

    const m = membersRes.data || [];
    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    setMembers(m.map(x => ({ ...x, display_name: profileMap[x.user_id] || null })));
    setCategories(categoriesRes.data || []);
    setRecurring(recurringRes.data || []);
    setSplitBetween(m.map((x) => x.user_id));
    setLoading(false);
  }, [user, groupId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m as MemberLike]));
  const dn = (userId: string) => getDisplay(memberMap[userId], user?.id || "", lang);

  const toggleSplit = (uid: string) => {
    setSplitBetween((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount || splitBetween.length === 0 || !user) return;
    setSubmitting(true);

    await supabase.from("recurring_expenses").insert({
      group_id: groupId,
      paid_by: user.id,
      name: name.trim(),
      amount: parseFloat(amount),
      currency,
      category_id: categoryId || null,
      frequency,
      next_date: nextDate,
      split_between: splitBetween,
      active: true,
    });

    setName(""); setAmount(""); setCategoryId(""); setShowForm(false);
    setSubmitting(false);
    fetchAll();
  };

  const toggleActive = async (item: RecurringExpense) => {
    await supabase
      .from("recurring_expenses")
      .update({ active: !item.active })
      .eq("id", item.id);
    fetchAll();
  };

  const getCategoryEmoji = (catId?: string) => {
    if (!catId) return "📦";
    return categories.find((c) => c.id === catId)?.emoji || "📦";
  };

  if (authLoading || !user || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/groups/${groupId}`)} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t("recurring_expenses")}</h1>
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full py-2.5 rounded-xl bg-violet-50 text-violet-600 font-medium border border-violet-200 hover:bg-violet-100 transition-colors mb-4"
      >
        {showForm ? t("cancel") : t("add_recurring")}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100 space-y-4">
          <input
            type="text" placeholder={t("expense_name_placeholder")} value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            required
          />

          <div className="flex gap-2">
            <input
              type="number" step="0.01" placeholder={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
              required
            />
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button type="button" onClick={() => setCurrency("CLP")}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currency === "CLP" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>
                CLP
              </button>
              <button type="button" onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currency === "USD" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>
                USD
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t("category")}</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id} type="button"
                  onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    categoryId === c.id
                      ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("frequency")}</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["weekly", "monthly", "yearly"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    frequency === f ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                  }`}>
                  {t(f)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("next_date")}</label>
            <input
              type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t("split_between")}</label>
            <div className="space-y-2">
              {members.map((m) => (
                <label key={m.user_id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitBetween.includes(m.user_id)}
                    onChange={() => toggleSplit(m.user_id)}
                    className="w-4 h-4 text-violet-500 rounded border-gray-300 focus:ring-violet-300"
                  />
                  <InitialsAvatar email={m.email} />
                  <span className="text-sm text-gray-700">
                    {dn(m.user_id)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? t("adding") : t("add_recurring")}
          </button>
        </form>
      )}

      {recurring.length === 0 && !showForm ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">⟳</p>
          <p>{t("no_recurring")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recurring.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-colors ${
                item.active ? "border-gray-100" : "border-gray-100 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getCategoryEmoji(item.category_id)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                    <span className="text-xs text-gray-400">⟳</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {t(item.frequency)} · {t("next_date")}: {item.next_date}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("split_colon")} {(item.split_between || []).map((uid) => dn(uid)).join(", ")}
                  </p>
                </div>
                <span className="font-semibold text-gray-700 whitespace-nowrap">
                  {formatAmount(Number(item.amount), item.currency)}
                </span>
                <button
                  onClick={() => toggleActive(item)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    item.active ? "bg-violet-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      item.active ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
