"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, Expense } from "@/lib/supabase";

function formatAmount(amount: number, currency: string) {
  if (currency === "CLP") return `$${Math.round(amount).toLocaleString("es-CL")}`;
  return `$${amount.toFixed(2)} USD`;
}

function groupExpenses(expenses: Expense[]) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekStr = startOfWeek.toISOString().slice(0, 10);
  
  const monthStr = now.toISOString().slice(0, 7);

  const today: Expense[] = [];
  const week: Expense[] = [];
  const month: Expense[] = [];

  for (const e of expenses) {
    if (e.date === todayStr) today.push(e);
    else if (e.date >= weekStr) week.push(e);
    else if (e.date.slice(0, 7) === monthStr) month.push(e);
  }

  return { today, week, month };
}

function totalByCurrency(expenses: Expense[]) {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    totals[e.currency] = (totals[e.currency] || 0) + Number(e.amount);
  }
  return Object.entries(totals).map(([c, a]) => formatAmount(a, c)).join(" + ") || "$0";
}

function ExpenseGroup({ title, expenses, onDelete }: { title: string; expenses: Expense[]; onDelete: (id: string) => void }) {
  if (expenses.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <span className="text-sm font-medium text-violet-600">{totalByCurrency(expenses)}</span>
      </div>
      <div className="space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{e.name}</p>
              <p className="text-xs text-gray-400">{e.date}</p>
            </div>
            <span className="font-semibold text-gray-700 mx-3 whitespace-nowrap">{formatAmount(Number(e.amount), e.currency)}</span>
            <button onClick={() => onDelete(e.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"CLP" | "USD">("CLP");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startOfMonth.toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    await supabase.from("expenses").insert({ name: name.trim(), amount: parseFloat(amount), currency, date });
    setName(""); setAmount(""); setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false); setSubmitting(false);
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const { today, week, month } = groupExpenses(expenses);

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Expenses</h1>
          <p className="text-sm text-gray-400">Track your spending</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-11 h-11 rounded-full bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-200 transition-all text-2xl font-light"
        >
          {showForm ? "×" : "+"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-5 mb-8 shadow-sm border border-gray-100 space-y-4">
          <input
            type="text" placeholder="Expense name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            required autoFocus
          />
          <div className="flex gap-3">
            <input
              type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
              required
            />
            <select
              value={currency} onChange={(e) => setCurrency(e.target.value as "CLP" | "USD")}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 bg-white"
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
          />
          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add Expense"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">💸</p>
          <p>No expenses yet this month</p>
        </div>
      ) : (
        <>
          <ExpenseGroup title="Today" expenses={today} onDelete={handleDelete} />
          <ExpenseGroup title="This Week" expenses={week} onDelete={handleDelete} />
          <ExpenseGroup title="Earlier This Month" expenses={month} onDelete={handleDelete} />
        </>
      )}
    </main>
  );
}
