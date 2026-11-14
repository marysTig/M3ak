export type ProspectStatus =
  | "new"
  | "contacted"
  | "interested"
  | "callback"
  | "trial"
  | "converted"
  | "rejected";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  interested: "Intéressé",
  callback: "À rappeler",
  trial: "Essai activé",
  converted: "Converti",
  rejected: "Refusé",
};

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, { bg: string; text: string; border: string }> = {
  new: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  contacted: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  interested: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
  callback: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  trial: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20" },
  converted: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  rejected: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
};

export interface Prospect {
  id: string;
  business_name: string;
  category: string | null;
  phone: string;
  email: string | null;
  wilaya: string;
  commune: string | null;
  address: string | null;
  contact_name: string | null;
  assigned_to: string | null;
  assigned_prospector?: {
    id: string;
    full_name: string;
    phone: string | null;
  } | null;
  status: ProspectStatus;
  notes: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  merchant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prospector {
  id: string;
  full_name: string;
  email?: string;
  phone: string | null;
  wilaya: string | null;
  commune: string | null;
  status: "active" | "suspended" | "pending";
  created_at: string;
  assigned_count?: number;
  trial_count?: number;
  converted_count?: number;
  total_commissions_earned?: number;
  pending_commissions?: number;
}

export type FollowupPriority = "low" | "medium" | "high" | "urgent";
export type FollowupStatus = "pending" | "completed" | "rescheduled" | "cancelled";

export interface CommercialFollowup {
  id: string;
  prospect_id: string;
  prospect_name?: string;
  prospect_phone?: string;
  prospect_wilaya?: string;
  prospector_id: string | null;
  prospector_name?: string;
  due_date: string;
  priority: FollowupPriority;
  status: FollowupStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export type CommissionStatus = "pending" | "approved" | "paid" | "cancelled";

export interface Commission {
  id: string;
  prospector_id: string;
  prospector_name?: string;
  prospect_id: string | null;
  prospect_name?: string;
  merchant_id: string | null;
  merchant_name?: string;
  payment_id: string | null;
  amount: number;
  client_paid_amount: number;
  plan_duration: string | null;
  status: CommissionStatus;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface CommissionPayout {
  id: string;
  prospector_id: string;
  prospector_name?: string;
  amount: number;
  payment_method: "cash" | "ccp" | "baridimob" | "bank_transfer";
  reference: string;
  paid_at: string;
  notes: string | null;
  created_at: string;
}

export interface ProspectionKPIs {
  totalProspects: number;
  newProspects: number;
  trialsActive: number;
  convertedTotal: number;
  conversionRate: number;
  totalCommissionsDue: number;
  totalCommissionsPaid: number;
  activeProspectors: number;
}

export interface ProspectionSettings {
  trialDays: number;
  commissionAmount: number;
  commissionRule: string;
}

