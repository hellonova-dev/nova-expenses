"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayName as getDisplay, MemberLike, translateCategory } from "@/lib/i18n";
import { Group, GroupMember, SharedExpense, ExpenseSplit, Balance, Category, Settlement } from "@/lib/types";
import InitialsAvatar from "@/components/InitialsAvatar";
import BottomNav from "@/components/BottomNav";

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

function getEmailForUser(members: GroupMember[], userId: string) {
  return members.find((m) => m.user_id === userId)?.email || "Unknown";
}

function calculateSimplifiedDebts(
  expenses: SharedExpense[],
  splits: ExpenseSplit[],
  settlements: Settlement[],
  members: GroupMember[]
): Balance[] {
  const currencies = new Set<string>();
  expenses.forEach((e) => currencies.add(e.currency));
  settlements.forEach((s) => currencies.add(s.currency));

  const allBalances: Balance[] = [];

  for (const currency of currencies) {
    const net: Record<string, number> = {};
    members.forEach((m) => (net[m.user_id] = 0));

    const currencyExpenses = expenses.filter((e) => e.currency === currency);
    for (const expense of currencyExpenses) {
      const expenseSplits = splits.filter(
        (s) => s.shared_expense_id === expense.id && !s.settled
      );
      for (const split of expenseSplits) {
        if (split.user_id !== expense.paid_by) {
          net[expense.paid_by] = (net[expense.paid_by] || 0) + Number(split.amount);
          net[split.user_id] = (net[split.user_id] || 0) - Number(split.amount);
        }
      }
    }

    const currencySettlements = settlements.filter((s) => s.currency === currency);
    for (const s of currencySettlements) {
      net[s.paid_by] = (net[s.paid_by] || 0) + Number(s.amount);
      net[s.paid_to] = (net[s.paid_to] || 0) - Number(s.amount);
    }

    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    for (const [userId, balance] of Object.entries(net)) {
      if (balance > 0.01) creditors.push({ id: userId, amount: balance });
      else if (balance < -0.01) debtors.push({ id: userId, amount: -balance });
    }

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amount = Math.min(creditors[ci].amount, debtors[di].amount);
      if (amount > 0.01) {
        allBalances.push({
          from: debtors[di].id,
          fromEmail: getEmailForUser(members, debtors[di].id),
          to: creditors[ci].id,
          toEmail: getEmailForUser(members, creditors[ci].id),
          amount,
          currency,
        });
      }
      creditors[ci].amount -= amount;
      debtors[di].amount -= amount;
      if (creditors[ci].amount < 0.01) ci++;
      if (debtors[di].amount < 0.01) di++;
    }
  }

  return allBalances;
}

export default function GroupDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<(GroupMember & { display_name?: string | null })[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"expenses" | "balances" | "members">("expenses");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; created_at: string }[]>([]);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  const [settleTarget, setSettleTarget] = useState<Balance | null>(null);
  const [settling, setSettling] = useState(false);

  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m as MemberLike]));
  const dn = (userId: string) => getDisplay(memberMap[userId], user?.id || "", lang);

  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;

    const [groupRes, membersRes, expensesRes, categoriesRes, settlementsRes, profilesRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("shared_expenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("categories").select("*"),
      supabase.from("settlements").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);

    setGroup(groupRes.data);
    const rawMembers = membersRes.data || [];
    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    setMembers(rawMembers.map(m => ({ ...m, display_name: profileMap[m.user_id] || null })));
    setExpenses(expensesRes.data || []);
    setCategories(categoriesRes.data || []);
    setSettlements(settlementsRes.data || []);

    if (expensesRes.data && expensesRes.data.length > 0) {
      const expIds = expensesRes.data.map((e: SharedExpense) => e.id);
      const { data: splitsData } = await supabase
        .from("expense_splits")
        .select("*")
        .in("shared_expense_id", expIds);
      setSplits(splitsData || []);
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      try {
        const invRes = await fetch(`/api/invite?groupId=${groupId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          setPendingInvites(invData.invites || []);
        }
      } catch (err) { console.error("Operation failed:", err); }
    }

    setLoading(false);
  }, [user, groupId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getCategoryEmoji = (catId?: string) => {
    if (!catId) return "📦";
    return categories.find((c) => c.id === catId)?.emoji || "📦";
  };

  const handleInvite = async (e: React.FormEvent, resendEmail?: string) => {
    e?.preventDefault?.();
    const email = (resendEmail || inviteEmail).trim();
    if (!email || !user?.email) return;
    setInviting(true);
    setInviteMsg(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, groupId, invitedByEmail: user.email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInviteMsg({ text: data.error || t("failed_to_invite"), type: "error" });
      } else if (data.status === "added") {
        setInviteMsg({ text: t("user_added"), type: "success" });
      } else if (data.status === "invited" || data.status === "resent") {
        setInviteMsg({ text: t("invite_sent"), type: "success" });
      } else if (data.status === "already_member") {
        setInviteMsg({ text: t("already_member"), type: "info" });
      }
    } catch (err) {
      console.error("Invite error:", err);
      setInviteMsg({ text: t("network_error"), type: "error" });
    }

    if (!resendEmail) setInviteEmail("");
    setInviting(false);
    fetchAll();
  };

  const handleRemoveMember = async (memberId: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    setRemovingMember(memberId);
    try {
      const res = await fetch("/api/members", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: memberId, groupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ text: data.error || t("failed_to_remove"), type: "error" });
      }
    } catch (err) { console.error("Operation failed:", err); }
    setRemovingMember(null);
    fetchAll();
  };

  const handleCancelInvite = async (email: string) => {
    setCancellingInvite(email);
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    try {
      await fetch("/api/invite", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, groupId }),
      });
    } catch (err) { console.error("Operation failed:", err); }
    setCancellingInvite(null);
    fetchAll();
  };

  const handleSettleConfirm = async () => {
    if (!settleTarget || !user) return;
    setSettling(true);

    const { error: settleErr } = await supabase.from("settlements").insert({
      group_id: groupId,
      paid_by: settleTarget.from,
      paid_to: settleTarget.to,
      amount: settleTarget.amount,
      currency: settleTarget.currency,
    });
    if (settleErr) { console.error("Settlement failed:", settleErr); alert(t("error")); setSettling(false); return; }

    const relevantExpenseIds = expenses
      .filter((e) => e.paid_by === settleTarget.to && e.currency === settleTarget.currency)
      .map((e) => e.id);

    if (relevantExpenseIds.length > 0) {
      const unsettled = splits.filter(
        (s) => relevantExpenseIds.includes(s.shared_expense_id) && s.user_id === settleTarget.from && !s.settled
      );

      let remaining = settleTarget.amount;
      for (const s of unsettled) {
        if (remaining <= 0) break;
        if (Number(s.amount) <= remaining) {
          await supabase.from("expense_splits").update({ settled: true }).eq("id", s.id);
          remaining -= Number(s.amount);
        }
      }
    }

    setSettleTarget(null);
    setSettling(false);
    fetchAll();
  };

  const handleDeleteGroup = async () => {
    if (!user || !group) return;
    setDeleting(true);
    try {
      // 1. Delete expense_splits for all expenses in this group
      const expIds = expenses.map((e) => e.id);
      if (expIds.length > 0) {
        await supabase.from("expense_splits").delete().in("shared_expense_id", expIds);
      }
      // 2. Delete shared_expenses
      await supabase.from("shared_expenses").delete().eq("group_id", groupId);
      // 3. Delete settlements
      await supabase.from("settlements").delete().eq("group_id", groupId);
      // 4. Delete recurring_expenses
      await supabase.from("recurring_expenses").delete().eq("group_id", groupId);
      // 5. Delete group_members
      await supabase.from("group_members").delete().eq("group_id", groupId);
      // 6. Delete pending_invites
      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        try {
          await fetch("/api/invite", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ groupId, deleteAll: true }),
          });
        } catch (err) { console.error("Operation failed:", err); }
      }
      await supabase.from("pending_invites").delete().eq("group_id", groupId);
      // 7. Delete expenses (personal expense records with group_id)
      await supabase.from("expenses").delete().eq("group_id", groupId);
      // 8. Delete the group
      await supabase.from("groups").delete().eq("id", groupId);
      router.replace("/");
    } catch {
      setDeleting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const { error: splitErr } = await supabase.from("expense_splits").delete().eq("shared_expense_id", expenseId);
    if (splitErr) { console.error("Failed to delete splits:", splitErr); alert(t("error")); return; }
    const { error: expErr } = await supabase.from("shared_expenses").delete().eq("id", expenseId);
    if (expErr) { console.error("Failed to delete expense:", expErr); alert(t("error")); return; }
    // Also clean up duplicate in expenses table
    await supabase.from("expenses").delete().eq("group_id", groupId).eq("name", expenses.find(e => e.id === expenseId)?.name || "");
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    setSplits((prev) => prev.filter((s) => s.shared_expense_id !== expenseId));
  };

  const balances = calculateSimplifiedDebts(expenses, splits, settlements, members);

  if (authLoading || !user || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  if (!group) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("group_not_found")}</div>;
  }

  const balancesByCurrency: Record<string, Balance[]> = {};
  balances.forEach((b) => {
    if (!balancesByCurrency[b.currency]) balancesByCurrency[b.currency] = [];
    balancesByCurrency[b.currency].push(b);
  });

  const memberCount = members.length;
  const memberCountText = memberCount === 1 ? t("member_count", { count: memberCount }) : t("member_count_plural", { count: memberCount });

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{group.emoji || "👥"}</span>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          </div>
          <p className="text-sm text-gray-400">{memberCountText}</p>
        </div>
        <button
          onClick={() => router.push(`/groups/${groupId}/recurring`)}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
          title={t("recurring_expenses")}
        >
          {t("recurring")}
        </button>
        {group.created_by === user.id && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title={t("delete_group")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {balances.length > 0 && (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{t("simplified_debts")}</span>
          </div>
          <div className="space-y-1">
            {balances.map((b, i) => {
              const youOwe = b.from === user.id;
              const youAreOwed = b.to === user.id;
              return (
                <p key={i} className="text-sm">
                  <span className={youOwe ? "text-red-500 font-medium" : youAreOwed ? "text-emerald-500 font-medium" : "text-gray-600"}>
                    {dn(b.from)} → {dn(b.to)}:{" "}
                    {formatAmount(b.amount, b.currency)}
                  </span>
                </p>
              );
            })}
          </div>
        </div>
      )}

      {settleTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-3 text-lg">{t("confirm_settlement")}</h3>
            <p className="text-gray-600 mb-5">
              {t("record_that", { from: dn(settleTarget.from), to: dn(settleTarget.to), amount: formatAmount(settleTarget.amount, settleTarget.currency) })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSettleConfirm}
                disabled={settling}
                className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {settling ? t("recording") : t("confirm")}
              </button>
              <button
                onClick={() => setSettleTarget(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-red-600 mb-2 text-lg">{t("confirm_delete_group")}</h3>
            <p className="text-gray-600 mb-5 text-sm">{t("delete_group_desc")}</p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteGroup}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? t("deleting") : t("delete_group")}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {(["expenses", "balances", "members"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === tabKey ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
            }`}
          >
            {t(tabKey)}
          </button>
        ))}
      </div>

      {tab === "expenses" && (
        <div>
          <button
            onClick={() => router.push(`/add?group=${groupId}`)}
            className="w-full py-2.5 rounded-xl bg-violet-50 text-violet-600 font-medium border border-violet-200 hover:bg-violet-100 transition-colors mb-3"
          >
            + {t("add_expense")}
          </button>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📝</p>
              <p>{t("no_expenses")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((e) => (
                <div key={e.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getCategoryEmoji(e.category_id)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{e.name}</p>
                      <p className="text-xs text-gray-400">
                        {e.date} · {t("x_paid", { name: dn(e.paid_by) })}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-700 whitespace-nowrap">
                      {formatAmount(Number(e.amount), e.currency)}
                    </span>
                    {e.paid_by === user.id && (
                      <button onClick={() => handleDeleteExpense(e.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "balances" && (
        <div>
          {balances.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">✅</p>
              <p>{t("all_settled_up")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(balancesByCurrency).map(([currency, currBalances]) => (
                <div key={currency}>
                  {Object.keys(balancesByCurrency).length > 1 && (
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{currency}</h3>
                  )}
                  <div className="space-y-2">
                    {currBalances.map((b, i) => {
                      const youOwe = b.from === user.id;
                      const youAreOwed = b.to === user.id;
                      return (
                        <div key={`${currency}-${i}`} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <InitialsAvatar email={b.fromEmail} />
                                <span className="text-gray-300 text-lg">→</span>
                                <InitialsAvatar email={b.toEmail} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800">
                                  <span className="font-medium">{dn(b.from)}</span>
                                  {" → "}
                                  <span className="font-medium">{dn(b.to)}</span>
                                </p>
                                <p className={`text-lg font-bold ${youOwe ? "text-red-500" : youAreOwed ? "text-emerald-500" : "text-gray-700"}`}>
                                  {formatAmount(b.amount, b.currency)}
                                </p>
                              </div>
                            </div>
                            {(youOwe || youAreOwed) && (
                              <button
                                onClick={() => setSettleTarget(b)}
                                className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors shrink-0"
                              >
                                {t("settle")}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {settlements.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t("settlement_history")}</h3>
              <div className="space-y-2">
                {settlements.map((s) => (
                  <div key={s.id} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          <span className="font-medium text-gray-600">{dn(s.paid_by)}</span>
                          {" → "}
                          <span className="font-medium text-gray-600">{dn(s.paid_to)}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-500">
                        {formatAmount(Number(s.amount), s.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <div>
          <div className="space-y-2 mb-4">
            {members.map((m) => {
              const isAdmin = m.user_id === group.created_by;
              const isYou = m.user_id === user.id;
              const canRemove = user.id === group.created_by && !isYou;
              return (
                <div key={m.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                  <InitialsAvatar email={m.email} size="md" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{dn(m.user_id)}</p>
                    <div className="flex gap-2">
                      {m.display_name && <span className="text-xs text-gray-400">{m.email}</span>}
                      {isAdmin && (
                        <span className="text-xs text-violet-500 font-medium">{t("admin")}</span>
                      )}
                      {isYou && !m.display_name && (
                        <span className="text-xs text-gray-400">({t("you").toLowerCase()})</span>
                      )}
                    </div>
                  </div>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      disabled={removingMember === m.user_id}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      title={t("remove_from_group")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {pendingInvites.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t("pending_invites")}</h3>
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                    <InitialsAvatar email={inv.email} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{inv.email}</p>
                      <span className="inline-block text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        {t("pending")}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleInvite(e, inv.email)}
                      disabled={inviting}
                      className="text-sm text-violet-500 hover:text-violet-700 font-medium transition-colors disabled:opacity-50"
                    >
                      {t("resend")}
                    </button>
                    <button
                      onClick={() => handleCancelInvite(inv.email)}
                      disabled={cancellingInvite === inv.email}
                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email" placeholder={t("invite_by_email")} value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800" required
            />
            <button type="submit" disabled={inviting}
              className="px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50">
              {inviting ? "..." : t("invite")}
            </button>
          </form>

          {inviteMsg && (
            <p className={`mt-2 text-sm font-medium ${
              inviteMsg.type === "success" ? "text-emerald-600" :
              inviteMsg.type === "error" ? "text-red-500" : "text-gray-500"
            }`}>
              {inviteMsg.text}
            </p>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
