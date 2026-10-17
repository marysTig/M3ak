import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M3ak — Connexion" },
      { name: "description", content: "Connectez-vous à votre espace fidélité M3ak." },
      { property: "og:title", content: "M3ak — Connexion" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    businessName: "",
  });
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validateSignIn() {
    const errs: { [k: string]: string } = {};
    if (!form.username.trim()) errs['username'] = "Nom d'utilisateur requis.";
    if (!form.password) errs['password'] = "Mot de passe requis.";
    return errs;
  }

  function validateSignUp() {
    const errs: { [k: string]: string } = {};
    if (!form.username.trim()) errs['username'] = "Nom d'utilisateur requis.";
    if (form.username.trim().length < 3) errs['username'] = "Minimum 3 caractères.";
    if (!form.businessName.trim()) errs['businessName'] = "Nom du commerce requis.";
    if (!form.password) errs['password'] = "Mot de passe requis.";
    if (form.password.length < 6) errs['password'] = "Minimum 6 caractères.";
    if (form.password !== form.confirmPassword) errs['confirmPassword'] = "Les mots de passe ne correspondent pas.";
    return errs;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSignIn();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      // Username → email synthétique pour Supabase Auth
      const email = `${form.username.trim().toLowerCase()}@m3ak.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (error) {
        toast.error("Identifiants incorrects", {
          description: "Vérifiez votre nom d'utilisateur et mot de passe.",
        });
        return;
      }

      // Redirection selon le rôle
      const userId = data.user?.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      const role = profile?.role ?? "customer";
      if (role === "admin") {
        navigate({ to: "/admin" });
      } else if (role === "merchant") {
        navigate({ to: "/business" });
      } else {
        navigate({ to: "/customer" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSignUp();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const username = form.username.trim().toLowerCase();
      const email = `${username}@m3ak.app`;

      // 1. Créer le compte
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: form.businessName.trim(),
            role: "merchant",
            username,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Nom d'utilisateur déjà pris", {
            description: "Choisissez un autre nom d'utilisateur.",
          });
        } else {
          toast.error(signUpError.message);
        }
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        toast.error("Erreur lors de la création du compte.");
        return;
      }

      // Attendre que le trigger crée le profil
      await new Promise((r) => setTimeout(r, 800));

      // 2. Mettre à jour le rôle en merchant
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: form.businessName.trim(),
        role: "merchant",
      }, { onConflict: "id" });

      // 3. Créer la fiche commerce
      const slug = username.replace(/[^a-z0-9]/g, "-");
      await supabase.from("merchants").insert({
        owner_id: userId,
        name: form.businessName.trim(),
        slug,
        status: "pending",
        plan: "starter",
      });

      toast.success("Compte créé avec succès !", {
        description: "Votre demande est en attente de validation par l'administrateur.",
      });

      // Connecter directement
      await supabase.auth.signInWithPassword({ email, password: form.password });
      navigate({ to: "/business" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">

      {/* Fond décoratif */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-chart-1/8 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
            alt="M3ak Logo"
            className="h-14 w-auto object-contain drop-shadow-lg"
          />
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Connectez-vous à votre espace" : "Créez votre programme de fidélité"}
          </p>
        </div>

        {/* Card formulaire */}
        <div className="rounded-2xl border border-border bg-surface/80 p-7 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">

          {/* Onglets Sign In / Sign Up */}
          <div className="mb-6 flex rounded-xl bg-surface-muted p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === "signin"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("signin"); setErrors({}); }}
            >
              Connexion
            </button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === "signup"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("signup"); setErrors({}); }}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">

            {/* Nom du commerce (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="businessName">Nom du commerce</Label>
                <Input
                  id="businessName"
                  placeholder="Ex: Café du Marché"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                  disabled={loading}
                  autoComplete="organization"
                />
                {errors['businessName'] && (
                  <p className="text-xs text-destructive">{errors['businessName']}</p>
                )}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  placeholder="moncommerce"
                  className="pl-9"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
                  disabled={loading}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
              {errors['username'] && (
                <p className="text-xs text-destructive">{errors['username']}</p>
              )}
            </div>

            {/* Mot de passe */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "signin" ? "••••••••" : "Minimum 6 caractères"}
                  className="pl-9 pr-10"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  disabled={loading}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors['password'] && (
                <p className="text-xs text-destructive">{errors['password']}</p>
              )}
            </div>

            {/* Confirmer mot de passe (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors['confirmPassword'] && (
                  <p className="text-xs text-destructive">{errors['confirmPassword']}</p>
                )}
              </div>
            )}

            {/* Info pending (signup) */}
            {mode === "signup" && (
              <div className="rounded-xl bg-warning-soft px-4 py-3 text-xs text-warning">
                ⏳ Votre compte sera activé après validation par l'administrateur.
              </div>
            )}

            <Button
              type="submit"
              className="mt-2 w-full"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="size-4 animate-spin" /> {mode === "signin" ? "Connexion…" : "Création…"}</>
              ) : mode === "signin" ? (
                "Se connecter"
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>
        </div>

        {/* Lien client */}
        <div className="text-center text-sm text-muted-foreground">
          Vous êtes un client ?{" "}
          <button
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={async () => {
              // Connexion anonyme ou redirection vers une page de téléchargement
              navigate({ to: "/customer" });
            }}
          >
            Accéder à votre portefeuille
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          M3ak Loyalty · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
