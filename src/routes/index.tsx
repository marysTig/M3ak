import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, QrCode, ShieldCheck, Sparkles, Store, User } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loyalty Platform — One account for every local business" },
      {
        name: "description",
        content:
          "Businesses create simple loyalty programs. Customers collect points and rewards from one account. Explore the admin, business and customer demos.",
      },
      { property: "og:title", content: "Loyalty Platform — One account for every local business" },
      {
        property: "og:description",
        content:
          "A product prototype for a multi-tenant loyalty platform: admin, business and customer experiences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const demos = [
  {
    role: "Admin",
    icon: ShieldCheck,
    copy: "Manage the entire loyalty network.",
    cta: "Open Admin",
    to: "/admin" as const,
  },
  {
    role: "Business",
    icon: Store,
    copy: "Create your loyalty program and grow repeat customers.",
    cta: "Open Business",
    to: "/business" as const,
  },
  {
    role: "Customer",
    icon: User,
    copy: "Keep all your loyalty cards in one place.",
    cta: "Open Customer",
    to: "/customer" as const,
  },
];

const steps = [
  { icon: QrCode, title: "Scan QR", copy: "Customers scan the QR at the counter." },
  { icon: Building2, title: "Join business", copy: "No new account, one profile everywhere." },
  { icon: Sparkles, title: "Earn points", copy: "Each business keeps its own balance." },
  { icon: ArrowRight, title: "Redeem", copy: "Rewards unlock automatically." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
            L
          </span>
          <span className="font-display text-base font-semibold">Loyalty Platform</span>
        </div>
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          Product prototype
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        <section className="py-12 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Loyalty for local businesses
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] sm:text-5xl md:text-6xl">
            One loyalty account for all your favorite local businesses.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Businesses create simple loyalty programs. Customers collect points and rewards from one
            account.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <div
              key={demo.role}
              className="card-surface flex flex-col gap-4 p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <demo.icon className="size-5" />
              </span>
              <div className="flex-1 space-y-1.5">
                <h2 className="text-lg font-semibold">{demo.role}</h2>
                <p className="text-sm text-muted-foreground">{demo.copy}</p>
              </div>
              <Button asChild className="w-full">
                <Link to={demo.to}>
                  {demo.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ))}
        </section>

        <section className="card-surface mt-14 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">How it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Points always stay with the business that issued them — never transferred, never merged.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-primary">
                    <step.icon className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                </div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Loyalty Platform — Product Prototype
      </footer>
    </div>
  );
}
