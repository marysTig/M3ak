import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import type { Merchant } from "@/lib/auth";
import { updateMerchant } from "@/lib/db/merchants";
import { updateProgram, setProgramStatus, getLoyaltyProgram } from "@/lib/db/program";
import type { LoyaltyProgram } from "@/lib/db/program";

export const Route = createFileRoute("/business/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — M3ak Loyalty" },
      { name: "description", content: "Business details, loyalty rules, team members and notification preferences." },
      { property: "og:title", content: "Paramètres — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SettingsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "",
    email: "",
    phone: "",
    address: "",
  });

  const [emailNotif, setEmailNotif] = useState(true);
  const [rewardNotif, setRewardNotif] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase
        .from("merchants")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (m) {
        const merch = m as Merchant;
        setMerchant(merch);
        setForm({
          name: merch.name ?? "",
          category: merch.category ?? "",
          email: merch.email ?? "",
          phone: merch.phone ?? "",
          address: merch.address ?? "",
        });

        const prog = await getLoyaltyProgram(merch.id);
        if (prog) {
          setProgram(prog);
          setEmailNotif(prog.email_notif);
          setRewardNotif(prog.reward_notif);
        }
      }
    });
  }, []);

  async function handleSave() {
    if (!merchant) return;
    setSaving(true);
    try {
      // Sauvegarder les infos du commerce
      const updated = await updateMerchant(merchant.id, {
        name: form.name.trim(),
        category: form.category.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      setMerchant(updated);

      // Sauvegarder les préférences de notifications
      if (program) {
        await updateProgram(merchant.id, {
          email_notif: emailNotif,
          reward_notif: rewardNotif,
        });
      }

      toast.success("Paramètres sauvegardés", {
        description: `Les informations de ${form.name} ont été mises à jour.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspend() {
    if (!merchant) return;
    try {
      await setProgramStatus(merchant.id, "suspended");
      toast.success("Programme suspendu", {
        description: "Les clients conservent leurs points mais ne peuvent plus en gagner.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suspension.");
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and loyalty rules."
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde..." : "Save changes"}
          </Button>
        }
      />

      <Section title="Business Information" description="Shown to customers when they join.">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["Business name", "name"],
            ["Category", "category"],
            ["Email", "email"],
            ["Phone", "phone"],
          ] as [string, keyof typeof form][]).map(([label, field]) => (
            <div key={label} className="space-y-2">
              <Label>{label}</Label>
              <Input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={label}
              />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="14 Rue des Lilas, 75011 Paris"
            />
          </div>
        </div>
      </Section>

      <Section title="Loyalty Settings" description="Current rules applied to every transaction.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Program type", "Points"],
            ["Earning rule", `${program?.points_per_euro ?? 1} € = 1 point`],
            ["Status", program?.status === "suspended" ? "Suspendu" : "Actif"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-muted p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Notifications" description="Choose what lands in your inbox.">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Daily summary of loyalty activity.</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium">Reward notifications</p>
              <p className="text-xs text-muted-foreground">Alert me whenever a reward is redeemed.</p>
            </div>
            <Switch checked={rewardNotif} onCheckedChange={setRewardNotif} />
          </div>
        </div>
      </Section>

      <section className="rounded-xl border border-destructive/30 bg-destructive-soft p-5 sm:p-6">
        <h2 className="font-semibold text-destructive">Danger Zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Suspending stops customers from earning and redeeming points.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              Suspend loyalty program
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend loyalty program?</AlertDialogTitle>
              <AlertDialogDescription>
                Customers keep their points but cannot earn or redeem until you reactivate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspend}>
                Suspend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </>
  );
}
