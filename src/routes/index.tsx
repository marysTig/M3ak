import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, QrCode, ShieldCheck, Sparkles, Store, User } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plateforme de Fidélité — Un seul compte pour chaque commerce local" },
      {
        name: "description",
        content:
          "Les commerces créent des programmes de fidélité simples. Les clients cumulent des points et des récompenses avec un seul compte. Découvrez les démos administrateur, commerce et client.",
      },
      { property: "og:title", content: "Plateforme de Fidélité — Un seul compte pour chaque commerce local" },
      {
        property: "og:description",
        content:
          "Un prototype de produit pour une plateforme de fidélité multi-locataires : expériences administrateur, commerce et client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const demos = [
  {
    role: "Administrateur",
    icon: ShieldCheck,
    copy: "Gérez l'ensemble du réseau de fidélité.",
    cta: "Ouvrir l'Administration",
    to: "/admin" as const,
  },
  {
    role: "Commerce",
    icon: Store,
    copy: "Créez votre programme de fidélité et fidélisez vos clients.",
    cta: "Ouvrir Commerce",
    to: "/business" as const,
  },
  {
    role: "Client",
    icon: User,
    copy: "Gardez toutes vos cartes de fidélité au même endroit.",
    cta: "Ouvrir Client",
    to: "/customer" as const,
  },
];

const steps = [
  { icon: QrCode, title: "Scanner le QR", copy: "Les clients scannent le QR à la caisse." },
  { icon: Building2, title: "Rejoindre le commerce", copy: "Pas de nouveau compte, un profil unique partout." },
  { icon: Sparkles, title: "Gagner des points", copy: "Chaque commerce garde son propre solde." },
  { icon: ArrowRight, title: "Échanger", copy: "Les récompenses se débloquent automatiquement." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-4 sm:px-5 sm:py-5">
        <img 
          src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png" 
          alt="Logo" 
          className="h-12 w-auto object-contain sm:h-16" 
        />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-5 sm:pb-20">
        <section className="pb-8 pt-2 text-center sm:pb-20 sm:pt-4">
          <h1 className="mx-auto mt-2 max-w-3xl text-3xl font-semibold leading-[1.2] sm:text-5xl md:text-6xl">
            Un seul compte de fidélité pour tous vos commerces locaux préférés.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Les commerces créent des programmes de fidélité simples. Les clients cumulent des points et des récompenses avec un seul compte.
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

        <section className="card-surface mt-10 p-5 text-center sm:mt-14 sm:p-8 sm:text-left">
          <h2 className="text-lg font-semibold">Comment ça marche</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les points restent toujours avec le commerce qui les a émis — jamais transférés, jamais fusionnés.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center space-y-2 sm:items-start">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-primary">
                    <step.icon className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Étape {i + 1}</span>
                </div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Plateforme de Fidélité
      </footer>
    </div>
  );
}
