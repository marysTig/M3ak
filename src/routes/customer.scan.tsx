import { createFileRoute } from "@tanstack/react-router";
import { Check, ScanLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoyaltyCard } from "@/components/app/loyalty-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/scan")({
  head: () => ({
    meta: [
      { title: "Scan to Join — Loyalty Platform" },
      {
        name: "description",
        content: "Scan a business QR code to add its loyalty card to your single account.",
      },
      { property: "og:title", content: "Scan to Join — Loyalty Platform" },
      {
        property: "og:description",
        content: "Scan a business QR code to add its loyalty card to your single account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

type Step = "scan" | "preview" | "joined";

function ScanPage() {
  const [step, setStep] = useState<Step>("scan");

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Join a business</h1>
        <p className="text-sm text-muted-foreground">
          Scan the QR at the counter — no new account needed.
        </p>
      </div>

      {step === "scan" ? (
        <div className="space-y-4">
          <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-border bg-foreground/90">
            <div className="absolute inset-10 rounded-2xl border-2 border-dashed border-background/40" />
            <div className="relative flex flex-col items-center gap-3 text-background">
              <ScanLine className="size-10 animate-pulse" />
              <p className="text-sm opacity-80">Point your camera at the QR code</p>
            </div>
          </div>
          <Button className="w-full" onClick={() => setStep("preview")}>
            Simulate scan
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Camera access is not part of this prototype.
          </p>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-4">
          <div className="card-surface space-y-2 p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="size-5" />
            </span>
            <p className="font-display text-lg font-semibold">Atelier Bagel</p>
            <p className="text-sm text-muted-foreground">Bakery · 240 m away</p>
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs">
              10 stamps = free bagel · 10 welcome points
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setStep("joined");
              toast.success("You joined Atelier Bagel", { description: "+10 welcome points" });
            }}
          >
            Join loyalty program
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep("scan")}>
            Cancel
          </Button>
        </div>
      ) : null}

      {step === "joined" ? (
        <div className="space-y-4">
          <div className="card-surface flex flex-col items-center gap-2 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="size-6" />
            </span>
            <p className="font-display text-lg font-semibold">You're in!</p>
            <p className="text-sm text-muted-foreground">
              Atelier Bagel was added to your loyalty wallet.
            </p>
          </div>
          <LoyaltyCard
            business="Atelier Bagel"
            category="Bakery"
            points={10}
            nextReward="Free Bagel"
            nextRewardAt={100}
            accent="var(--color-chart-5)"
            initials="AB"
          />
          <Button variant="outline" className="w-full" onClick={() => setStep("scan")}>
            Scan another business
          </Button>
        </div>
      ) : null}
    </>
  );
}
