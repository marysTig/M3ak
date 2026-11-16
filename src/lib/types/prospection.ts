export type ProspectStatus =
  | "callback"
  | "trial"
  | "rejected"
  | "new"
  | "contacted"
  | "interested"
  | "converted";

export const PROSPECTOR_EDITABLE_STATUSES: { id: ProspectStatus; label: string }[] = [
  { id: "callback", label: "À rappeler" },
  { id: "trial", label: "Essai gratuit" },
  { id: "rejected", label: "Refusé" },
];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  callback: "À rappeler",
  trial: "Essai gratuit",
  rejected: "Refusé",
  new: "Nouveau",
  contacted: "Contacté",
  interested: "Intéressé",
  converted: "Converti",
};

export const PROSPECT_STATUS_COLORS: Record<string, string> = {
  callback: "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50",
  trial: "bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700/50",
  rejected: "bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/50",
  new: "bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50",
  contacted: "bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700/50",
  interested: "bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-700/50",
  converted: "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50",
};

export type ProspectFinale = "paid" | "unpaid" | null;

export const PROSPECT_FINALE_LABELS: Record<string, string> = {
  paid: "Payé",
  unpaid: "Non payé",
  none: "— En attente —",
};

export const PROSPECT_FINALE_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50",
  unpaid: "bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/50",
  none: "bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

export interface Prospect {
  id: string;
  business_name: string;
  wilaya: string;
  commune: string | null;
  phone: string;
  category: string | null; // Activité
  status: ProspectStatus; // Géré exclusivement par le prospecteur
  finale: ProspectFinale; // Géré exclusivement par l'administrateur
  notes: string | null;
  contact_name?: string | null;
  address?: string | null;
  assigned_to: string | null;
  assigned_at?: string | null;
  import_id?: string | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  converted_at?: string | null;
  created_at: string;
  updated_at?: string;
  prospector?: {
    id: string;
    full_name: string;
    username?: string;
    phone?: string | null;
    wilaya?: string | null;
  } | null;
}

export interface Prospector {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  phone: string | null;
  wilaya: string | null;
  commune: string | null;
  status: "active" | "suspended";
  notes?: string | null;
  created_at: string;
  assigned_count?: number;
  active_trials_count?: number;
  conversions_count?: number;
  total_commission_da?: number;
}

export interface ProspectImport {
  id: string;
  filename: string;
  imported_by: string | null;
  assigned_to: string | null;
  total_rows: number;
  valid_rows: number;
  created_at: string;
  prospector?: {
    id: string;
    full_name: string;
  } | null;
}

export interface ProspectAssignment {
  id: string;
  prospect_id: string;
  prospector_id: string;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
}

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  prospector_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
}

export type FollowupPriority = "low" | "medium" | "high" | "urgent";

export interface CommercialFollowup {
  id: string;
  prospect_id: string;
  prospector_id: string | null;
  due_date: string;
  priority: FollowupPriority;
  status: "pending" | "completed";
  notes: string | null;
  created_at: string;
  prospect?: {
    business_name: string;
    phone: string;
  } | null;
}

export interface Commission {
  id: string;
  prospector_id: string;
  prospect_id?: string | null;
  merchant_id?: string | null;
  amount_da: number;
  subscription_amount_da?: number;
  status: "pending" | "validated" | "paid" | "cancelled";
  created_at: string;
  prospector?: {
    full_name: string;
    wilaya?: string;
  } | null;
  prospect?: {
    business_name: string;
  } | null;
  merchant?: {
    business_name: string;
  } | null;
}

export interface CommissionPayout {
  id: string;
  prospector_id: string;
  amount_da: number;
  payment_method: string;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  prospector?: {
    full_name: string;
  } | null;
}

export interface ProspectionKPIs {
  total_leads: number;
  active_trials: number;
  conversions: number;
  conversion_rate: number;
  commissions_pending_da: number;
  commissions_paid_da: number;
}

export interface ProspectionSettings {
  trial_days: number;
  commission_amount_da: number;
  alert_days_before: number;
  require_payment_for_commission: boolean;
  auto_deactivate_on_expiry: boolean;
  auto_assign_by_wilaya: boolean;
}
