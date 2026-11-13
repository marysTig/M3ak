import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Phone, User } from "lucide-react";
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

function toAuthEmail(input: string): { email: string; username: string } {
  const clean = input.trim().toLowerCase();
  const base = clean.includes("@") ? clean.split("@")[0] : clean;
  const username = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.-]/g, "");
  return {
    email: `${username}@m3ak.app`,
    username,
  };
}

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
    phone: "",
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
      const { email, username: cleanUser } = toAuthEmail(form.username);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (error) {
        console.error("Supabase Auth Error:", error.message, error);
        if (error.message.includes("Email not confirmed")) {
          toast.error("Compte non confirmé", {
            description: "Votre compte n'est pas encore confirmé. Exécutez le script SQL pour confirmer tous les comptes.",
          });
        } else if (error.message.includes("disabled") || (error as { code?: string }).code === "email_provider_disabled") {
          toast.error("Authentification désactivée dans Supabase", {
            description: "Activez le provider 'Email' dans Supabase Dashboard > Authentication > Providers > Email.",
          });
        } else {
          toast.error("Identifiants incorrects", {
            description: `Vérifiez votre nom d'utilisateur et mot de passe (${error.message}).`,
          });
        }
        return;
      }

      // Redirection selon le rôle
      const userId = data.user?.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const role = profile?.role ?? (data.user?.user_metadata?.role as string) ?? "customer";
      if (role === "admin") {
        navigate({ to: "/admin" });
      } else if (role === "merchant") {
        // Garantit que la fiche commerce existe
        const { data: existingM } = await supabase
          .from("merchants")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();

        if (!existingM) {
          const mName = data.user?.user_metadata?.full_name || cleanUser;
          const baseSlug = cleanUser.replace(/[^a-z0-9]/g, "-") || "commerce";

          // S'assurer que le profil existe d'abord
          await supabase.from("profiles").upsert({
            id: userId,
            full_name: mName,
            role: "merchant",
          }, { onConflict: "id" });

          const res = await supabase.from("merchants").insert({
            owner_id: userId,
            name: mName,
            slug: baseSlug,
            status: "active",
            plan: "starter",
          });
          if (res.error) {
            await supabase.from("merchants").insert({
              owner_id: userId,
              name: mName,
              slug: `${baseSlug}-${userId.slice(0, 5)}`,
              status: "active",
              plan: "starter",
            });
          }
        }

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
      const { email, username: cleanUser } = toAuthEmail(form.username);

      // 1. Créer le compte
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: form.businessName.trim(),
            role: "merchant",
            username: cleanUser,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Nom d'utilisateur déjà pris", {
            description: "Choisissez un autre nom d'utilisateur.",
          });
        } else if (signUpError.message.includes("disabled") || (signUpError as { code?: string }).code === "email_provider_disabled") {
          toast.error("Authentification désactivée dans Supabase", {
            description: "Activez le provider 'Email' dans Supabase Dashboard > Authentication > Providers > Email pour permettre l'inscription par mot de passe.",
          });
        } else if (signUpError.message.includes("rate limit")) {
          toast.error("Trop de tentatives", {
            description: "Veuillez patienter quelques instants avant de réessayer.",
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

      // 2. Connexion directe pour établir la session
      await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      // 3. Assurer que le profil et la fiche commerce sont créés
      const baseSlug = cleanUser.replace(/[^a-z0-9]/g, "-") || "commerce";
      const cleanPhone = form.phone.trim() || null;

      await supabase.from("profiles").upsert({
        id: userId,
        full_name: form.businessName.trim(),
        phone: cleanPhone,
        role: "merchant",
      }, { onConflict: "id" });

      let mRow = null;
      const res = await supabase.from("merchants").insert({
        owner_id: userId,
        name: form.businessName.trim(),
        phone: cleanPhone,
        slug: baseSlug,
        status: "active",
        plan: "starter",
      }).select().maybeSingle();

      if (!res.error && res.data) {
        mRow = res.data;
      } else {
        const res2 = await supabase.from("merchants").insert({
          owner_id: userId,
          name: form.businessName.trim(),
          phone: cleanPhone,
          slug: `${baseSlug}-${userId.slice(0, 5)}`,
          status: "active",
          plan: "starter",
        }).select().maybeSingle();
        if (res2.data) mRow = res2.data;
      }

      if (mRow) {
        await supabase.from("loyalty_programs").upsert({
          merchant_id: mRow.id,
          theme_id: "aurora",
          status: "active",
        }, { onConflict: "merchant_id" });
      }

      toast.success("Compte créé avec succès !", {
        description: "Bienvenue sur M3ak ! Votre compte est activé.",
      });

      navigate({ to: "/business" });
    } catch (err) {
      console.error("Erreur signup:", err);
      toast.error("Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-3.5 sm:px-4 py-8 sm:py-12">

      {/* Fond décoratif */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-chart-1/8 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] space-y-5 sm:space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2.5 sm:gap-3">
          <img
            src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
            alt="M3ak Logo"
            className="h-12 sm:h-14 w-auto object-contain drop-shadow-lg"
          />
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            {mode === "signin" ? "Connectez-vous à votre espace" : "Créez votre programme de fidélité"}
          </p>
        </div>

        {/* Card formulaire */}
        <div className="rounded-2xl border border-border bg-surface/80 p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">

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

            {/* Téléphone (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Numéro de téléphone <span className="text-muted-foreground text-xs font-normal">(Optionnel)</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0550 12 34 56"
                    className="pl-9"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
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

            {/* Info activation immédiate (signup) */}
            {mode === "signup" && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Votre compte est activé automatiquement dès sa création.</span>
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
