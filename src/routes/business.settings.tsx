import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { business, staff } from "@/lib/mock-data";

export const Route = createFileRoute("/business/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Business details, loyalty rules, team members and notification preferences.",
      },
      { property: "og:title", content: "Settings — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Business details, loyalty rules, team members and notification preferences.",
      },
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
  const [emailNotif, setEmailNotif] = useState(true);
  const [rewardNotif, setRewardNotif] = useState(true);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and loyalty rules."
        actions={<Button onClick={() => toast.success("Settings saved")}>Save changes</Button>}
      />

      <Section title="Business Information" description="Shown to customers when they join.">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Business name", business.name],
            ["Category", business.category],
            ["Email", business.email],
            ["Phone", business.phone],
          ].map(([label, value]) => (
            <div key={label} className="space-y-2">
              <Label>{label}</Label>
              <Input defaultValue={value} />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input defaultValue={business.address} />
          </div>
        </div>
      </Section>

      <Section title="Loyalty Settings" description="Current rules applied to every transaction.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Program type", "Points"],
            ["Earning rule", "1 € = 1 point"],
            ["Reward rule", "100 points = Free Coffee"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-muted p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Team" description="People who can issue points at the counter.">
        <ul className="space-y-2">
          {staff.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {s.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
              </div>
              <StatusBadge status={s.role} tone={s.role === "Owner" ? "info" : "neutral"} />
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => toast.success("Invite sent (demo)")}
        >
          <Plus className="size-4" /> Invite team member
        </Button>
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
              <AlertDialogAction onClick={() => toast.success("Program suspended (demo)")}>
                Suspend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </>
  );
}
