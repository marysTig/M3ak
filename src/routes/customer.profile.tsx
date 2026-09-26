import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { customerActivity, customerProfile, memberships } from "@/lib/mock-data";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Loyalty Platform" },
      {
        name: "description",
        content: "Your single loyalty account: memberships, activity history and notifications.",
      },
      { property: "og:title", content: "My Profile — Loyalty Platform" },
      {
        property: "og:description",
        content: "Your single loyalty account: memberships, activity history and notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [push, setPush] = useState(true);
  const [offers, setOffers] = useState(false);
  const totalPoints = memberships.reduce((s, m) => s + m.points, 0);

  return (
    <>
      <div className="card-surface flex items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
          {customerProfile.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{customerProfile.name}</p>
          <p className="truncate text-sm text-muted-foreground">{customerProfile.email}</p>
          <p className="text-xs text-muted-foreground">Member since {customerProfile.memberSince}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          [String(memberships.length), "Cards"],
          [String(totalPoints), "Points"],
          ["7", "Rewards"],
        ].map(([value, label]) => (
          <div key={label} className="card-surface p-4 text-center">
            <p className="font-display text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Activity history</h2>
        <ul className="card-surface divide-y divide-border">
          {customerActivity.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.business} · {a.time}
                </p>
              </div>
              <span
                className={
                  a.positive
                    ? "shrink-0 text-sm font-medium text-success"
                    : "shrink-0 text-sm font-medium text-muted-foreground"
                }
              >
                {a.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Notifications</h2>
        <div className="card-surface divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Reward alerts</p>
              <p className="text-xs text-muted-foreground">When a reward becomes available.</p>
            </div>
            <Switch checked={push} onCheckedChange={setPush} />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Local offers</p>
              <p className="text-xs text-muted-foreground">New businesses joining near you.</p>
            </div>
            <Switch checked={offers} onCheckedChange={setOffers} />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Link
          to="/customer/discover"
          className="card-surface flex items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Discover new businesses
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <button
          onClick={() => toast.success("Account details saved (demo)")}
          className="card-surface flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Account details
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </section>

      <Button asChild variant="outline" className="w-full">
        <Link to="/">
          <LogOut className="size-4" /> Exit demo
        </Link>
      </Button>
    </>
  );
}
