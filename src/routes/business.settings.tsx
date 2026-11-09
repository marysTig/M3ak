import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Merchant } from "@/lib/auth";
import { updateMerchant, getMyMerchant } from "@/lib/db/merchants";

export const Route = createFileRoute("/business/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — M3ak Loyalty" },
      { name: "description", content: "Gérez les informations de votre commerce." },
      { property: "og:title", content: "Paramètres — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    getMyMerchant().then((merch) => {
      if (merch) {
        setMerchant(merch);
        setForm({
          name: merch.name ?? "",
          category: merch.category ?? "",
          email: merch.email ?? "",
          phone: merch.phone ?? "",
          address: merch.address ?? "",
        });
      }
    });
  }, []);

  async function handleSave() {
    if (!merchant) return;
    setSaving(true);
    try {
      const updated = await updateMerchant(merchant.id, {
        name: form.name.trim(),
        category: form.category.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      setMerchant(updated);
      toast.success("Paramètres sauvegardés", {
        description: `Les informations de ${form.name} ont été mises à jour.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Paramètres"
        subtitle="Gérez les informations de votre commerce."
        actions={
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Sauvegarde..." : "Enregistrer"}
          </Button>
        }
      />

      <section className="card-surface p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="font-semibold">Informations du commerce</h2>
          <p className="text-sm text-muted-foreground">
            Ces informations sont affichées à vos clients lorsqu'ils rejoignent votre programme.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["Nom du commerce", "name", "Mon Commerce"],
            ["Catégorie", "category", "Restauration, Beauté…"],
            ["Email", "email", "contact@moncommerce.dz"],
            ["Téléphone", "phone", "07XXXXXXXX"],
          ] as [string, keyof typeof form, string][]).map(([label, field, placeholder]) => (
            <div key={field} className="space-y-2">
              <Label>{label}</Label>
              <Input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={placeholder}
              />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label>Adresse</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rue, quartier, ville…"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
