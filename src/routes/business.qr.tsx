import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/business/qr")({
  head: () => ({
    meta: [
      { title: "Votre QR Code Fidélité — M3ak" },
      { name: "description", content: "Imprimez votre QR code pour que vos clients rejoignent votre programme de fidélité." },
      { property: "og:title", content: "Votre QR Code Fidélité — M3ak" },
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
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [joinLink, setJoinLink] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("merchants")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (data) {
        const m = data as Merchant;
        setMerchant(m);

        // Générer le lien de jointure
        const slug = m.slug ?? m.id;
        const link = `${window.location.origin}/join/${slug}`;
        setJoinLink(link);

        // Générer le vrai QR code
        try {
          const url = await QRCode.toDataURL(link, {
            width: 280,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQrDataUrl(url);
        } catch (err) {
          console.error("QR generation error:", err);
        }
      }
    });
  }, []);

  async function handleDownload() {
    if (!qrDataUrl || !merchant) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-fidelite-${merchant.slug ?? merchant.id}.png`;
    a.click();
    toast.success("QR code téléchargé", {
      description: `qr-fidelite-${merchant.slug ?? merchant.id}.png`,
    });
  }

  async function handlePrint() {
    if (!qrDataUrl || !merchant) {
      toast.error("QR code non encore généré.");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les popups.");
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Fidélité — ${merchant.name}</title>
          <style>
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; }
            img { width:280px; height:280px; }
            h1 { margin-top:16px; font-size:24px; }
            p { color:#666; margin-top:8px; }
          </style>
        </head>
        <body>
          <img src="${qrDataUrl}" alt="QR Code Fidélité" />
          <h1>${merchant.name}</h1>
          <p>Rejoignez notre programme de fidélité</p>
          <p style="font-size:12px;margin-top:4px">${joinLink}</p>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  async function handleCopyLink() {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      toast.success("Lien copié !", { description: joinLink });
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  return (
    <>
      <PageHeader
        title="Your Loyalty QR Code"
        subtitle="Customers scan this QR code to join your loyalty program."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface flex flex-col items-center gap-6 p-8">
          {/* Vrai QR code */}
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code fidélité ${merchant?.name ?? ""}`}
              className="size-[200px] rounded-xl"
            />
          ) : (
            <div className="flex size-[200px] items-center justify-center rounded-xl bg-surface-muted text-sm text-muted-foreground">
              Génération…
            </div>
          )}

          <div className="text-center">
            <p className="font-display text-xl font-semibold">{merchant?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">Join our loyalty program</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={handleDownload} disabled={!qrDataUrl}>
              <Download className="size-4" /> Download QR
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl}>
              <Printer className="size-4" /> Print QR
            </Button>
            <Button variant="outline" onClick={handleCopyLink} disabled={!joinLink}>
              <Copy className="size-4" /> Copy Link
            </Button>
          </div>

          {joinLink && (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground break-all text-center">
              {joinLink}
            </p>
          )}
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
