import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/prospector/login")({
  head: () => ({
    meta: [
      { title: "Espace Commercial — Connexion Prospecteur — M3ak" },
      { name: "description", content: "Connexion à votre espace prospecteur avec username et mot de passe." },
    ],
  }),
  component: ProspectorLoginPage,
});

function toAuthEmail(input: string): string {
  const clean = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.-]/g, "");
  return `${clean}@m3ak.app`;
}

function ProspectorLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setErrorMsg("Veuillez saisir votre nom d'utilisateur.");
      return;
    }
    if (!password) {
      setErrorMsg("Veuillez saisir votre mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const email = toAuthEmail(cleanUser);

      // Authentification Supabase par identifiants
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("Identifiants incorrects. Vérifiez votre nom d'utilisateur et mot de passe.");
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setErrorMsg("Impossible de valider la session.");
        return;
      }

      // Vérifier le rôle et le statut actif du prospecteur
      const { data: profile, error: profError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.status === "suspended") {
        await supabase.auth.signOut();
        setErrorMsg("Votre compte commercial a été suspendu par l'administrateur.");
        return;
      }

      if (profile && profile.role !== "prospector" && profile.role !== "admin") {
        setErrorMsg("Accès réservé exclusivement aux prospecteurs de terrain.");
        return;
      }

      toast.success("Connexion réussie", {
        description: `Bienvenue dans votre espace commercial M3ak.`,
      });

      navigate({ to: "/prospector" });
    } catch (err: any) {
      setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* En-tête */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-sm border border-primary/20">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Espace Prospecteur M3ak
          </h1>
          <p className="text-sm text-muted">
            Connectez-vous à votre CRM commercial avec votre nom d'utilisateur.
          </p>
        </div>

        {/* Formulaire de connexion */}
        <div className="rounded-3xl border border-border/80 bg-surface/80 p-8 shadow-xl backdrop-blur-md">
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user">Nom d'utilisateur</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                <Input
                  id="user"
                  placeholder="Ex: karim.benali"
                  className="pl-9 bg-surface font-medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                <Input
                  id="pass"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-10 bg-surface"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 mt-2 h-11 text-sm font-semibold shadow-md"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Connexion en cours..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/50 text-center text-xs text-muted">
            Vous n'avez pas encore d'accès ? Contactez l'administrateur M3ak pour obtenir votre compte commercial.
          </div>
        </div>
      </div>
    </div>
  );
}

