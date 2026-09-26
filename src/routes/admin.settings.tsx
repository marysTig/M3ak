import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Loyalty Admin" },
      {
        name: "description",
        content: "Default plan limits, onboarding rules and platform-wide notifications.",
      },
      { property: "og:title", content: "Platform Settings — Loyalty Admin" },
      {
        property: "og:description",
        content: "Default plan limits, onboarding rules and platform-wide notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [digest, setDigest] = useState(true);

  return (
    <>
      <PageHeader
        title="Platform settings"
        subtitle="Rules applied to every business on the network."
        actions={<Button onClick={() => toast.success("Settings saved")}>Save changes</Button>}
      />

      <section className="card-surface p-5 sm:p-6">
        <h2 className="font-semibold">Platform identity</h2>
        <p className="text-sm text-muted-foreground">Shown in emails and customer apps.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Platform name</Label>
            <Input defaultValue="Loyalty Platform" />
          </div>
          <div className="space-y-2">
            <Label>Support email</Label>
            <Input defaultValue="support@loyal.app" />
          </div>
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <h2 className="font-semibold">Plans</h2>
        <p className="text-sm text-muted-foreground">Monthly price per business.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            ["Starter", "€0", "Up to 300 customers"],
            ["Growth", "€39", "Up to 2,000 customers"],
            ["Pro", "€79", "Unlimited customers"],
          ].map(([plan, price, limit]) => (
            <div key={plan} className="rounded-xl bg-surface-muted p-4">
              <p className="text-sm font-medium">{plan}</p>
              <p className="font-display text-2xl font-semibold">{price}</p>
              <p className="text-xs text-muted-foreground">{limit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <h2 className="font-semibold">Onboarding & notifications</h2>
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium">Auto-approve new businesses</p>
              <p className="text-xs text-muted-foreground">Skip manual review of applications.</p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium">Weekly network digest</p>
              <p className="text-xs text-muted-foreground">Growth and revenue summary by email.</p>
            </div>
            <Switch checked={digest} onCheckedChange={setDigest} />
          </div>
        </div>
      </section>
    </>
  );
}
