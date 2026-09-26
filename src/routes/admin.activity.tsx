import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { adminActivity } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({
    meta: [
      { title: "Platform Activity — Loyalty Admin" },
      {
        name: "description",
        content: "Applications, plan changes and account warnings across the loyalty network.",
      },
      { property: "og:title", content: "Platform Activity — Loyalty Admin" },
      {
        property: "og:description",
        content: "Applications, plan changes and account warnings across the loyalty network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminActivity,
});

const kinds: Record<string, { icon: LucideIcon; className: string }> = {
  pending: { icon: Clock, className: "bg-warning-soft text-warning" },
  billing: { icon: CreditCard, className: "bg-primary-soft text-primary" },
  warning: { icon: AlertTriangle, className: "bg-destructive-soft text-destructive" },
  success: { icon: CheckCircle2, className: "bg-success-soft text-success" },
};

function AdminActivity() {
  return (
    <>
      <PageHeader title="Activity" subtitle="Everything happening across the network." />

      <ul className="card-surface divide-y divide-border">
        {adminActivity.map((a) => {
          const conf = kinds[a.kind] ?? kinds.billing;
          const Icon = conf.icon;
          return (
            <li key={a.id} className="flex items-start gap-4 p-4">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${conf.className}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.time}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
