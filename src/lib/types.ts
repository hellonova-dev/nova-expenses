/** @deprecated Use SharedExpense instead — kept for legacy/migration compatibility */
export type Expense = {
  id: string;
  name: string;
  amount: number;
  currency: 'USD' | 'CLP';
  date: string;
  created_at: string;
  user_id: string;
  category_id?: string;
  group_id?: string;
};

export type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  emoji?: string;
  group_type?: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  email: string;
  joined_at: string;
  display_name?: string | null;
};

export type SharedExpense = {
  id: string;
  group_id: string;
  paid_by: string;
  name: string;
  amount: number;
  currency: string;
  date: string;
  created_at: string;
  category_id?: string;
};

export type ExpenseSplit = {
  id: string;
  shared_expense_id: string;
  user_id: string;
  amount: number;
  settled: boolean;
};

export type Balance = {
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  amount: number;
  currency: string;
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
};

export type Settlement = {
  id: string;
  group_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  currency: string;
  created_at: string;
};

export type RecurringExpense = {
  id: string;
  group_id: string;
  paid_by: string;
  name: string;
  amount: number;
  currency: string;
  category_id?: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  next_date: string;
  split_between: string[];
  active: boolean;
  created_at: string;
};
