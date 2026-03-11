// Simple i18n translation system — no external packages

type Translations = Record<string, string>;

const en: Translations = {
  // Navigation
  home: "Home",
  activity: "Activity",
  spending: "Spending",
  profile: "Profile",

  // Home page
  welcome_back: "Hey, {name} 👋",
  youre_owed: "You're owed {amount}",
  you_owe: "You owe {amount}",
  all_settled: "All settled up ✅",
  your_groups: "Your Groups",
  no_groups: "No groups yet",
  create_first_group: "Create a group to start splitting expenses",
  create_group: "+ Create Group",
  recent_activity: "Recent Activity",
  see_all: "See all →",
  add_expense: "Add Expense",
  settled: "settled",
  welcome_new_user: "Welcome to Nova Expenses! 👋",
  onboarding_text: "Create a group to start splitting costs with friends, family, or roommates.",

  // Add expense
  select_group: "Select a group",
  expense_name: "What was it for?",
  amount: "Amount",
  date: "Date",
  category: "Category",
  who_paid: "Who paid?",
  split_method: "Split method",
  equal: "Equal",
  custom: "Custom",
  percentage: "%",
  split_between: "Split between",
  each: "{amount} each",
  adding: "Adding...",
  add_expense_btn: "Add Expense",
  group_label: "Group",

  // Groups
  groups: "Groups",
  group_name: "Group name",
  group_emoji: "Type & emoji",
  choose_emoji: "Choose emoji",
  invite_members: "Invite members",
  invite_by_email: "friend@email.com",
  skip: "Skip",
  next: "Next",
  create: "Create Group",
  creating: "Creating...",
  no_groups_yet: "No groups yet",
  split_with_friends: "Create a group to start splitting expenses",
  new_group: "New Group",
  step_of: "Step {current}/{total}",

  // Group detail
  expenses: "Expenses",
  balances: "Balances",
  members: "Members",
  no_expenses: "No expenses yet",
  all_settled_up: "All settled up!",
  simplified_debts: "Simplified Debts",
  settlement_history: "Settlement History",
  pays: "{from} pays {to}",
  settle: "Settle",
  confirm_settlement: "Confirm Settlement",
  record_that: "Record that {from} paid {to} {amount}?",
  paid_to: "paid",
  confirm: "Confirm",
  cancel: "Cancel",
  recording: "Recording...",
  pending: "Pending",
  resend: "Resend",
  invite_sent: "Invite sent ✓",
  user_added: "User added to group ✓",
  already_member: "Already a member",
  remove_from_group: "Remove from group",
  admin: "Admin",
  you: "You",
  invite: "Invite",
  pending_invites: "Pending Invites",
  invite_later: "You can always invite people later",
  member_count: "{count} member",
  member_count_plural: "{count} members",
  recurring: "⟳ Recurring",
  x_paid: "{name} paid",

  // Activity
  today: "Today",
  yesterday: "Yesterday",
  tomorrow: "Tomorrow",
  later: "Later",
  this_week: "This Week",
  earlier: "Earlier",
  no_activity: "No activity yet",
  no_activity_desc: "Expenses and settlements will show up here",
  paid_for: "{name} paid {amount} for {expense}",
  settled_with: "{name} settled {amount} with {other}",

  // Spending
  this_month: "This Month",
  last_month: "Last Month",
  total_spent: "Total Spent",
  daily_avg: "~{amount}/day",
  by_category: "By Category",
  by_group: "By Group",
  no_spending: "No spending data",
  no_spending_desc: "Add expenses to see your breakdown",

  // Profile
  display_name: "Display Name",
  display_name_placeholder: "How others see you",
  language: "Language",
  sign_out: "Sign Out",
  member_since: "Member since {date}",
  custom_categories: "Custom Categories",
  no_custom_categories: "No custom categories yet",
  add_category: "Add",
  category_name: "Category name",
  emoji: "Emoji",

  // Login
  sign_in: "Sign In",
  sign_up: "Sign Up",
  magic_link: "Sign in with magic link",
  email: "Email",
  password: "Password",
  send_magic_link: "Send Magic Link",
  check_email_magic: "Check your email for the magic link!",
  check_email_confirm: "Check your email to confirm your account!",
  no_account: "Don't have an account?",
  have_account: "Already have an account?",
  use_magic_link: "Use magic link instead",
  sign_in_password: "Sign in with password",
  sign_in_to: "Sign in to your account",
  create_account: "Create your account",

  // Auth confirm
  setting_up_account: "Setting up your account...",

  // Recurring
  recurring_expenses: "⟳ Recurring Expenses",
  add_recurring: "+ Add Recurring Expense",
  cancel_add: "Cancel",
  frequency: "Frequency",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  next_date: "Next date",
  active: "Active",
  inactive: "Inactive",
  no_recurring: "No recurring expenses yet",
  expense_name_placeholder: "Expense name",
  split_colon: "Split:",

  // Misc
  loading: "Loading...",
  save: "Save",
  saved: "Saved",
  delete: "Delete",
  error: "Error",
  redirecting: "Redirecting...",
  someone: "Someone",
  group_not_found: "Group not found",
  network_error: "Network error",
  failed_to_invite: "Failed to invite",
  failed_to_remove: "Failed to remove",

  // Delete group
  delete_group: "Delete Group",
  confirm_delete_group: "Delete this group?",
  delete_group_desc: "This will permanently delete the group and all its expenses, settlements, and data. This action cannot be undone.",
  deleting: "Deleting...",

  // Group types
  group_type_household: "Household",
  group_type_trip: "Trip",
  group_type_couple: "Couple",
  group_type_event: "Event",
  group_type_food: "Food",
  group_type_work: "Work",

  // Emoji hint
  emoji_hint: "Tap the emoji to customize",

  // Default categories
  cat_food_drinks: "Food & Drinks",
  cat_rent: "Rent",
  cat_utilities: "Utilities",
  cat_transport: "Transport",
  cat_entertainment: "Entertainment",
  cat_shopping: "Shopping",
  cat_health: "Health",
  cat_travel: "Travel",
  cat_groceries: "Groceries",
  cat_other: "Other",
};

const es: Translations = {
  // Navigation
  home: "Inicio",
  activity: "Actividad",
  spending: "Gastos",
  profile: "Perfil",

  // Home page
  welcome_back: "Hola, {name} 👋",
  youre_owed: "Te deben {amount}",
  you_owe: "Debes {amount}",
  all_settled: "Todo al día ✅",
  your_groups: "Tus Grupos",
  no_groups: "Sin grupos aún",
  create_first_group: "Crea un grupo para empezar a dividir gastos",
  create_group: "+ Crear Grupo",
  recent_activity: "Actividad Reciente",
  see_all: "Ver todo →",
  add_expense: "Agregar Gasto",
  settled: "al día",
  welcome_new_user: "¡Bienvenido a Nova Expenses! 👋",
  onboarding_text: "Crea un grupo para empezar a dividir gastos con amigos, familia o compañeros.",

  // Add expense
  select_group: "Selecciona un grupo",
  expense_name: "¿En qué se gastó?",
  amount: "Monto",
  date: "Fecha",
  category: "Categoría",
  who_paid: "¿Quién pagó?",
  split_method: "Método de división",
  equal: "Igual",
  custom: "Personalizado",
  percentage: "%",
  split_between: "Dividir entre",
  each: "{amount} c/u",
  adding: "Agregando...",
  add_expense_btn: "Agregar Gasto",
  group_label: "Grupo",

  // Groups
  groups: "Grupos",
  group_name: "Nombre del grupo",
  group_emoji: "Tipo y emoji",
  choose_emoji: "Elegir emoji",
  invite_members: "Invitar miembros",
  invite_by_email: "amigo@email.com",
  skip: "Omitir",
  next: "Siguiente",
  create: "Crear Grupo",
  creating: "Creando...",
  no_groups_yet: "Sin grupos aún",
  split_with_friends: "Crea un grupo para empezar a dividir gastos",
  new_group: "Nuevo Grupo",
  step_of: "Paso {current}/{total}",

  // Group detail
  expenses: "Gastos",
  balances: "Balances",
  members: "Miembros",
  no_expenses: "Sin gastos aún",
  all_settled_up: "¡Todo al día!",
  simplified_debts: "Deudas Simplificadas",
  settlement_history: "Historial de Pagos",
  pays: "{from} le paga a {to}",
  settle: "Saldar",
  confirm_settlement: "Confirmar Pago",
  record_that: "¿Registrar que {from} le pagó a {to} {amount}?",
  paid_to: "pagó",
  confirm: "Confirmar",
  cancel: "Cancelar",
  recording: "Registrando...",
  pending: "Pendiente",
  resend: "Reenviar",
  invite_sent: "Invitación enviada ✓",
  user_added: "Usuario agregado al grupo ✓",
  already_member: "Ya es miembro",
  remove_from_group: "Eliminar del grupo",
  admin: "Admin",
  you: "Tú",
  invite: "Invitar",
  pending_invites: "Invitaciones Pendientes",
  invite_later: "Siempre puedes invitar personas después",
  member_count: "{count} miembro",
  member_count_plural: "{count} miembros",
  recurring: "⟳ Recurrente",
  x_paid: "{name} pagó",

  // Activity
  today: "Hoy",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  later: "Próximamente",
  this_week: "Esta Semana",
  earlier: "Antes",
  no_activity: "Sin actividad aún",
  no_activity_desc: "Los gastos y pagos aparecerán aquí",
  paid_for: "{name} pagó {amount} por {expense}",
  settled_with: "{name} saldó {amount} con {other}",

  // Spending
  this_month: "Este Mes",
  last_month: "Mes Pasado",
  total_spent: "Total Gastado",
  daily_avg: "~{amount}/día",
  by_category: "Por Categoría",
  by_group: "Por Grupo",
  no_spending: "Sin datos de gastos",
  no_spending_desc: "Agrega gastos para ver tu desglose",

  // Profile
  display_name: "Nombre",
  display_name_placeholder: "Cómo te ven los demás",
  language: "Idioma",
  sign_out: "Cerrar Sesión",
  member_since: "Miembro desde {date}",
  custom_categories: "Categorías Personalizadas",
  no_custom_categories: "Sin categorías personalizadas aún",
  add_category: "Agregar",
  category_name: "Nombre de categoría",
  emoji: "Emoji",

  // Login
  sign_in: "Iniciar Sesión",
  sign_up: "Registrarse",
  magic_link: "Iniciar con enlace mágico",
  email: "Email",
  password: "Contraseña",
  send_magic_link: "Enviar Enlace Mágico",
  check_email_magic: "¡Revisa tu email para el enlace mágico!",
  check_email_confirm: "¡Revisa tu email para confirmar tu cuenta!",
  no_account: "¿No tienes cuenta?",
  have_account: "¿Ya tienes cuenta?",
  use_magic_link: "Usar enlace mágico",
  sign_in_password: "Iniciar con contraseña",
  sign_in_to: "Inicia sesión en tu cuenta",
  create_account: "Crea tu cuenta",

  // Auth confirm
  setting_up_account: "Configurando tu cuenta...",

  // Recurring
  recurring_expenses: "⟳ Gastos Recurrentes",
  add_recurring: "+ Agregar Gasto Recurrente",
  cancel_add: "Cancelar",
  frequency: "Frecuencia",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
  next_date: "Próxima fecha",
  active: "Activo",
  inactive: "Inactivo",
  no_recurring: "Sin gastos recurrentes aún",
  expense_name_placeholder: "Nombre del gasto",
  split_colon: "Dividen:",

  // Misc
  loading: "Cargando...",
  save: "Guardar",
  saved: "Guardado",
  delete: "Eliminar",
  error: "Error",
  redirecting: "Redirigiendo...",
  someone: "Alguien",
  group_not_found: "Grupo no encontrado",
  network_error: "Error de red",
  failed_to_invite: "Error al invitar",
  failed_to_remove: "Error al eliminar",

  // Delete group
  delete_group: "Eliminar Grupo",
  confirm_delete_group: "¿Eliminar este grupo?",
  delete_group_desc: "Esto eliminará permanentemente el grupo y todos sus gastos, pagos y datos. Esta acción no se puede deshacer.",
  deleting: "Eliminando...",

  // Group types
  group_type_household: "Hogar",
  group_type_trip: "Viaje",
  group_type_couple: "Pareja",
  group_type_event: "Evento",
  group_type_food: "Comida",
  group_type_work: "Trabajo",

  // Emoji hint
  emoji_hint: "Toca el emoji para personalizar",

  // Default categories
  cat_food_drinks: "Comida y Bebidas",
  cat_rent: "Arriendo",
  cat_utilities: "Servicios",
  cat_transport: "Transporte",
  cat_entertainment: "Entretenimiento",
  cat_shopping: "Compras",
  cat_health: "Salud",
  cat_travel: "Viajes",
  cat_groceries: "Supermercado",
  cat_other: "Otro",
};

const translations: Record<string, Translations> = { en, es };

const SYSTEM_CATEGORY_MAP: Record<string, string> = {
  "Food & Drinks": "cat_food_drinks",
  "Rent": "cat_rent",
  "Utilities": "cat_utilities",
  "Transport": "cat_transport",
  "Entertainment": "cat_entertainment",
  "Shopping": "cat_shopping",
  "Health": "cat_health",
  "Travel": "cat_travel",
  "Groceries": "cat_groceries",
  "Other": "cat_other",
};

export function translateCategory(name: string, lang: string): string {
  const key = SYSTEM_CATEGORY_MAP[name];
  if (key) return t(key, lang);
  return name;
}

export function t(key: string, lang: string, params?: Record<string, string | number>): string {
  const dict = translations[lang] || translations.en;
  let text = dict[key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export type MemberLike = {
  user_id: string;
  email: string;
  display_name?: string | null;
};

export function getDisplayName(
  member: MemberLike | undefined,
  currentUserId: string,
  lang: string
): string {
  if (!member) return lang === "es" ? "Alguien" : "Someone";
  if (member.user_id === currentUserId) return lang === "es" ? "Tú" : "You";
  if (member.display_name) return member.display_name;
  return member.email.split("@")[0];
}
