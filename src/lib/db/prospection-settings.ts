import { supabase } from "@/lib/supabase";
import type { ProspectionSettings } from "@/lib/types/prospection";

export async function getProspectionSettings(): Promise<ProspectionSettings> {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["prospection_trial_days", "prospection_commission_amount", "prospection_commission_rule"]);

    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

    return {
      trialDays: parseInt(map["prospection_trial_days"] || "7", 10),
      commissionAmount: parseInt(map["prospection_commission_amount"] || "1500", 10),
      commissionRule: map["prospection_commission_rule"] || "paid_subscription_only",
    };
  } catch (err) {
    console.error("Erreur getProspectionSettings :", err);
    return {
      trialDays: 7,
      commissionAmount: 1500,
      commissionRule: "paid_subscription_only",
    };
  }
}

export async function updateProspectionSettings(settings: Partial<ProspectionSettings>): Promise<boolean> {
  const rows: { key: string; value: string }[] = [];

  if (settings.trialDays !== undefined) {
    rows.push({ key: "prospection_trial_days", value: String(settings.trialDays) });
  }
  if (settings.commissionAmount !== undefined) {
    rows.push({ key: "prospection_commission_amount", value: String(settings.commissionAmount) });
  }
  if (settings.commissionRule !== undefined) {
    rows.push({ key: "prospection_commission_rule", value: settings.commissionRule });
  }

  for (const r of rows) {
    await supabase.from("platform_settings").upsert(r, { onConflict: "key" });
  }

  return true;
}

