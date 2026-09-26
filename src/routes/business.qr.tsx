import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { MockQr } from "@/components/app/mock-qr";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business/qr")({
  head: () => ({
    meta: [
      { title: "Your Loyalty QR Code — Bloom Café" },
      {
        name: "description",
        content: "Print the Bloom Café QR code so customers can join the loyalty program in one scan.",
      },
      { property: "og:title", content: "Your Loyalty QR Code — Bloom Café" },
      {
        property: "og:description",
        content: "Print the Bloom Café QR code so customers can join the loyalty program in one scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QrPage,
});

const steps = [
  "Print your QR code.",
  "Place it at your checkout.",
  "Ask customers to scan.",
  "Customers join your loyalty program.",
];

function QrPage() {
  return (
    <>
      <PageHeader
        title="Your Loyalty QR Code"
        subtitle="Customers scan this QR code to join your loyalty program."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface flex flex-col items-center gap-6 p-8">
          <MockQr label="BC" />
          <div className="text-center">
            <p className="font-display text-xl font-semibold">{business.name}</p>
            <p className="text-sm text-muted-foreground">Join our loyalty program</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => toast.success("QR code downloaded (demo)")}>
              <Download className="size-4" /> Download QR
            </Button>
            <Button variant="outline" onClick={() => toast.success("Sent to printer (demo)")}>
              <Printer className="size-4" /> Print QR
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success("Join link copied", { description: business.joinLink })}
            >
              <Copy className="size-4" /> Copy Link
            </Button>
          </div>
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
            {business.joinLink}
          </p>
        </div>

        <div className="card-surface h-fit p-6">
          <h2 className="font-semibold">How to use it</h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-xl bg-surface-muted p-4 text-xs text-muted-foreground">
            Customers never create a new account — they scan once and your program is added to their
            existing loyalty wallet.
          </p>
        </div>
      </div>
    </>
  );
}
