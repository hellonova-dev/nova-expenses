-- ============================================================
-- Nova Expenses: Complete Schema (Single Source of Truth)
-- Last updated: 2026-02-24
-- ============================================================

-- ============================================================
-- Security Definer Functions (must exist before RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shared_expense_member(eid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_expenses se
    JOIN public.group_members gm ON gm.group_id = se.group_id
    WHERE se.id = eid AND gm.user_id = uid
  );
$$;

-- ============================================================
-- Tables
-- ============================================================

-- Profiles (synced from auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories (global, seeded)
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  emoji text NOT NULL DEFAULT '📦',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Groups
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text DEFAULT '👥',
  group_type text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Personal Expenses
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES categories(id),
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Shared Expenses (group expenses)
CREATE TABLE shared_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Expense Splits
CREATE TABLE expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_expense_id uuid NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL,
  settled boolean NOT NULL DEFAULT false
);

-- Settlements
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES auth.users(id),
  paid_to uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recurring Expenses
CREATE TABLE recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  category_id uuid REFERENCES categories(id),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_date date NOT NULL,
  split_between jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pending Invites
CREATE TABLE pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, email)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Categories (read-only for all)
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT USING (true);

-- Groups
CREATE POLICY "Members can view group" ON groups FOR SELECT
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update group" ON groups FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "Creator can delete group" ON groups FOR DELETE
  USING (created_by = auth.uid());

-- Group Members
CREATE POLICY "Members can view group members" ON group_members FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members can add members" ON group_members FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()) OR
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid()));
CREATE POLICY "Members can remove themselves" ON group_members FOR DELETE
  USING (user_id = auth.uid());

-- Personal Expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE
  USING (user_id = auth.uid());

-- Shared Expenses
CREATE POLICY "Members can view shared expenses" ON shared_expenses FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members can add shared expenses" ON shared_expenses FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Payer can delete shared expense" ON shared_expenses FOR DELETE
  USING (paid_by = auth.uid());

-- Expense Splits
CREATE POLICY "Members can view expense splits" ON expense_splits FOR SELECT
  USING (public.is_shared_expense_member(shared_expense_id, auth.uid()));
CREATE POLICY "Members can create expense splits" ON expense_splits FOR INSERT
  WITH CHECK (public.is_shared_expense_member(shared_expense_id, auth.uid()));
CREATE POLICY "Users can settle their own splits" ON expense_splits FOR UPDATE
  USING (user_id = auth.uid());

-- Settlements
CREATE POLICY "Members can view settlements" ON settlements FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members can create settlements" ON settlements FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- Recurring Expenses
CREATE POLICY "Members can view recurring expenses" ON recurring_expenses FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members can create recurring expenses" ON recurring_expenses FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members can update recurring expenses" ON recurring_expenses FOR UPDATE
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Creator can delete recurring expenses" ON recurring_expenses FOR DELETE
  USING (paid_by = auth.uid());

-- Pending Invites
CREATE POLICY "Members can create invites" ON pending_invites FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Users can read their own invites" ON pending_invites FOR SELECT
  USING (email IN (SELECT email FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Invitees can delete their invites" ON pending_invites FOR DELETE
  USING (email IN (SELECT email FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_shared_expenses_group ON shared_expenses(group_id);
CREATE INDEX idx_shared_expenses_paid_by ON shared_expenses(paid_by);
CREATE INDEX idx_expense_splits_expense ON expense_splits(shared_expense_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX idx_settlements_group ON settlements(group_id);
CREATE INDEX idx_recurring_expenses_group ON recurring_expenses(group_id);
CREATE INDEX idx_recurring_expenses_next_date ON recurring_expenses(next_date) WHERE active = true;
CREATE INDEX idx_pending_invites_email ON pending_invites(email);
CREATE INDEX idx_pending_invites_group ON pending_invites(group_id);

-- ============================================================
-- Default Categories
-- ============================================================

INSERT INTO categories (name, emoji) VALUES
  ('Food & Drinks', '🍔'),
  ('Rent', '🏠'),
  ('Utilities', '💡'),
  ('Transport', '🚗'),
  ('Entertainment', '🎬'),
  ('Shopping', '🛍️'),
  ('Health', '💊'),
  ('Travel', '✈️'),
  ('Groceries', '🛒'),
  ('Other', '📦')
ON CONFLICT (name) DO NOTHING;
