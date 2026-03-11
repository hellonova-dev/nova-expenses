"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayName as getDisplay, MemberLike, translateCategory } from "@/lib/i18n";
import { Group, GroupMember, Category } from "@/lib/types";
import InitialsAvatar from "@/components/InitialsAvatar";

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

const CATEGORY_COLORS: Record<string, string> = {
  "food & drinks": "bg-orange-50 border-orange-200",
  "rent": "bg-blue-50 border-blue-200",
  "utilities": "bg-yellow-50 border-yellow-200",
  "transport": "bg-red-50 border-red-200",
  "entertainment": "bg-purple-50 border-purple-200",
  "shopping": "bg-pink-50 border-pink-200",
  "health": "bg-green-50 border-green-200",
  "travel": "bg-cyan-50 border-cyan-200",
  "groceries": "bg-lime-50 border-lime-200",
  "other": "bg-gray-50 border-gray-200",
};

export default function AddExpensePageWrapper() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>}>
      <AddExpensePage />
    </Suspense>
  );
}

function AddExpensePage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroup = searchParams.get("group");

  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<(GroupMember & { display_name?: string | null })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupId, setGroupId] = useState(preselectedGroup || "");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"CLP" | "USD">("CLP");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMethod, setSplitMethod] = useState<"equal" | "custom" | "percentage">("equal");
  const [involvedIds, setInvolvedIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [groupMemberships, categoriesRes] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user.id),
        supabase.from("categories").select("*").order("name"),
      ]);

      setCategories(categoriesRes.data || []);

      if (groupMemberships.data && groupMemberships.data.length > 0) {
        const ids = groupMemberships.data.map((m) => m.group_id);
        const { data } = await supabase.from("groups").select("*").in("id", ids).order("name");
        setGroups(data || []);
        if (preselectedGroup && ids.includes(preselectedGroup)) {
          setGroupId(preselectedGroup);
        }
      }
      setLoading(false);
    })();
  }, [user, preselectedGroup]);

  const fetchMembers = useCallback(async () => {
    if (!groupId) { setMembers([]); return; }
    const { data } = await supabase.from("group_members").select("*").eq("group_id", groupId);
    const m = data || [];
    // Fetch display names
    const userIds = m.map((x) => x.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
    const profileMap = Object.fromEntries((profiles || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    const enriched = m.map((x) => ({ ...x, display_name: profileMap[x.user_id] || null }));
    setMembers(enriched);
    setInvolvedIds(m.map((x) => x.user_id));
    if (user && m.find((x) => x.user_id === user.id)) {
      setPaidBy(user.id);
    }
  }, [groupId, user]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const toggleInvolved = (uid: string) => {
    setInvolvedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount || !groupId || involvedIds.length === 0 || !user) return;
    setSubmitting(true);

    const totalAmount = parseFloat(amount);

    // Validate custom splits sum to total
    if (splitMethod === "custom") {
      const customSum = involvedIds.reduce((sum, uid) => sum + parseFloat(customAmounts[uid] || "0"), 0);
      if (Math.abs(customSum - totalAmount) > 0.01) {
        alert(lang === "es" ? `Los montos personalizados suman ${customSum.toFixed(2)}, pero el total es ${totalAmount.toFixed(2)}` : `Custom amounts sum to ${customSum.toFixed(2)}, but total is ${totalAmount.toFixed(2)}`);
        setSubmitting(false);
        return;
      }
    }
    if (splitMethod === "percentage") {
      const pctSum = involvedIds.reduce((sum, uid) => sum + parseFloat(percentages[uid] || "0"), 0);
      if (Math.abs(pctSum - 100) > 0.01) {
        alert(lang === "es" ? `Los porcentajes suman ${pctSum.toFixed(1)}%, deben sumar 100%` : `Percentages sum to ${pctSum.toFixed(1)}%, must equal 100%`);
        setSubmitting(false);
        return;
      }
    }

    const { data: newExpense } = await supabase
      .from("shared_expenses")
      .insert({
        group_id: groupId,
        paid_by: paidBy,
        name: name.trim(),
        amount: totalAmount,
        currency,
        date,
        category_id: categoryId || null,
      })
      .select()
      .single();

    if (newExpense) {
      let splitRows;
      if (splitMethod === "equal") {
        const perPerson = totalAmount / involvedIds.length;
        splitRows = involvedIds.map((uid) => ({
          shared_expense_id: newExpense.id,
          user_id: uid,
          amount: perPerson,
        }));
      } else if (splitMethod === "percentage") {
        splitRows = involvedIds.map((uid) => ({
          shared_expense_id: newExpense.id,
          user_id: uid,
          amount: (totalAmount * parseFloat(percentages[uid] || "0")) / 100,
        }));
      } else {
        splitRows = involvedIds.map((uid) => ({
          shared_expense_id: newExpense.id,
          user_id: uid,
          amount: parseFloat(customAmounts[uid] || "0"),
        }));
      }
      const { error: splitErr } = await supabase.from("expense_splits").insert(splitRows);
      if (splitErr) { console.error("Failed to insert splits:", splitErr); alert(t("error")); setSubmitting(false); return; }
    } else {
      console.error("Failed to insert shared expense");
      alert(t("error"));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (preselectedGroup) {
      router.push(`/groups/${preselectedGroup}`);
    } else {
      router.push("/");
    }
  };

  if (authLoading || !user || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  const getMemberDisplay = (m: MemberLike) => getDisplay(m, user.id, lang);

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-8 overflow-x-hidden">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t("add_expense")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("group_label")}</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 bg-white"
            required
          >
            <option value="">{t("select_group")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji || "👥"} {g.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <input
            type="number" step="0.01" placeholder={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            required
          />
          <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
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

        <input
          type="text" placeholder={t("expense_name")} value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
          required
        />

        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full max-w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 box-border"
          style={{ WebkitAppearance: "none" }}
        />

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">{t("category")}</label>
          <div className="grid grid-cols-5 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                className={`flex flex-col items-center p-2 rounded-xl border transition-all text-center ${
                  categoryId === c.id
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : CATEGORY_COLORS[c.name.toLowerCase()] || "bg-gray-50 border-gray-200"
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="text-[10px] text-gray-600 mt-0.5 leading-tight">{translateCategory(c.name, lang)}</span>
              </button>
            ))}
          </div>
        </div>

        {members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("who_paid")}</label>
            <select
              value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 bg-white"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {getMemberDisplay(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        {members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("split_method")}</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { key: "equal" as const, label: t("equal") },
                { key: "custom" as const, label: t("custom") },
                { key: "percentage" as const, label: t("percentage") },
              ]).map((m) => (
                <button key={m.key} type="button" onClick={() => setSplitMethod(m.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    splitMethod === m.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t("split_between")}</label>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={involvedIds.includes(m.user_id)}
                    onChange={() => toggleInvolved(m.user_id)}
                    className="w-4 h-4 text-violet-500 rounded border-gray-300 focus:ring-violet-300"
                  />
                  <InitialsAvatar email={m.email} />
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {getMemberDisplay(m)}
                  </span>
                  {splitMethod === "custom" && involvedIds.includes(m.user_id) && (
                    <input
                      type="number" step="0.01" placeholder="0"
                      value={customAmounts[m.user_id] || ""}
                      onChange={(e) => setCustomAmounts((p) => ({ ...p, [m.user_id]: e.target.value }))}
                      className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                  )}
                  {splitMethod === "percentage" && involvedIds.includes(m.user_id) && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" step="1" placeholder="0" min="0" max="100"
                        value={percentages[m.user_id] || ""}
                        onChange={(e) => setPercentages((p) => ({ ...p, [m.user_id]: e.target.value }))}
                        className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                      <span className="text-sm text-gray-400">%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {splitMethod === "equal" && involvedIds.length > 0 && amount && (
              <p className="text-xs text-gray-400 mt-2">
                {t("each", { amount: formatAmount(parseFloat(amount) / involvedIds.length, currency) })}
              </p>
            )}
          </div>
        )}

        <button
          type="submit" disabled={submitting || !groupId}
          className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? t("adding") : t("add_expense_btn")}
        </button>
      </form>
    </main>
  );
}
