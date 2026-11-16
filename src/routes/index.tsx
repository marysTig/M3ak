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
  const clean = input.trim();

  // 1. Si l'utilisateur saisit une adresse email complète
  if (clean.includes("@")) {
    return {
      email: clean.toLowerCase(),
      username: (clean.split("@")[0] ?? clean).toLowerCase(),
    };
  }

  // 2. Si l'utilisateur saisit un nom d'utilisateur (username)
  const cleanUser = clean
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.-]/g, "");

  return {
    email: `${cleanUser}@m3ak.app`,
    username: cleanUser,
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
    if (!form.businessName.trim()) errs['businessName'] = "Nom du commerce obligatoire.";
    const cleanPhone = form.phone.trim();
    const phoneDigits = cleanPhone.replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      errs['phone'] = "Le numéro de téléphone est obligatoire.";
    } else if (phoneDigits.length < 9) {
      errs['phone'] = "Numéro de téléphone invalide (au moins 9 chiffres, ex: 0550 12 34 56).";
    }
    if (!form.username.trim()) errs['username'] = "Nom d'utilisateur obligatoire.";
    if (form.username.trim().length < 3) errs['username'] = "Minimum 3 caractères.";
    if (!form.password) errs['password'] = "Mot de passe obligatoire.";
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
            description: "Votre compte n'est pas encore confirmé dans Supabase. Exécutez la mise à jour SQL.",
          });
        } else if (error.message.includes("disabled") || (error as { code?: string }).code === "email_provider_disabled") {
          toast.error("Authentification désactivée dans Supabase", {
            description: "Activez le provider 'Email' dans Supabase Dashboard > Authentication > Providers > Email.",
          });
        } else {
          toast.error("Identifiants incorrects", {
            description: "Nom d'utilisateur / email ou mot de passe invalide. Vérifiez vos identifiants.",
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

      const role = profile?.["role"] ?? (data.user?.user_metadata?.["role"] as string) ?? "customer";
      if (role === "admin") {
        navigate({ to: "/admin" });
      } else if (role === "prospector") {
        navigate({ to: "/prospector" });
      } else if (role === "merchant") {
        // Garantit que la fiche commerce existe
        const { data: existingM } = await supabase
          .from("merchants")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();

        if (!existingM) {
          const mName = (data.user?.user_metadata ? data.user.user_metadata['full_name'] : null) || cleanUser;
          const baseSlug = cleanUser.replace(/[^a-z0-9]/g, "-") || "commerce";

          // S'assurer que le profil existe d'abord
          await supabase.from("profiles").upsert({
            id: userId,
            full_name: mName,
            role: "merchant",
          }, { onConflict: "id" });

          // Insérer le commerce avec toutes les colonnes requises
          const { error: merchantErr } = await supabase.from("merchants").insert({
            owner_id: userId,
            name: mName,
            slug: `${baseSlug}-${(userId ?? "").slice(0, 5)}`,
            status: "active",
            plan: "starter",
            subscription_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            is_trial: true,
          });

          if (merchantErr) {
            console.error("[handleSignIn] Erreur création commerce:", merchantErr.message);
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
      const cleanPhone = form.phone.trim();
      if (!cleanPhone || cleanPhone.replace(/[^0-9]/g, "").length < 9) {
        setErrors({ phone: "Le numéro de téléphone est obligatoire (au moins 9 chiffres)." });
        setLoading(false);
        return;
      }
      const cleanBusinessName = form.businessName.trim();

      // 1. Créer le compte utilisateur dans Supabase Auth
      // Les métadonnées sont transmises au trigger database handle_new_user()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: cleanBusinessName,
            role: "merchant",
            username: cleanUser,
            phone: cleanPhone,
          },
        },
      });

      if (signUpError) {
        // Vérifier si c'est une erreur de rate limit HTTP 429 ou email
        const errStatus = (signUpError as { status?: number }).status;
        const isRateLimit =
          errStatus === 429 ||
          signUpError.message.toLowerCase().includes("rate limit") ||
          signUpError.message.toLowerCase().includes("too many") ||
          (signUpError as { code?: string }).code === "over_email_send_rate_limit";

        if (isRateLimit) {
          // Supabase a rejeté la requête (limite API dépassée).
          // L'utilisateur n'a pas été créé → afficher un message propre en français.
          toast.error("Trop d'inscriptions en peu de temps", {
            description:
              "Le service est momentanément saturé. Attendez 1 à 2 minutes puis réessayez.",
          });
          return;
        } else if (
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("User already registered")
        ) {
          toast.error("Nom d'utilisateur déjà pris", {
            description:
              "Cet identifiant existe déjà. Choisissez un autre nom d'utilisateur ou connectez-vous.",
          });
          return;
        } else if (
          signUpError.message.includes("disabled") ||
          (signUpError as { code?: string }).code === "email_provider_disabled"
        ) {
          toast.error("Authentification désactivée", {
            description: "Contactez l'administrateur pour activer les inscriptions.",
          });
          return;
        } else {
          // Autre erreur inattendue : on tente quand même une connexion directe
          // (l'utilisateur peut déjà exister si le compte a été créé lors d'un appel précédent)
          console.warn(
            "[handleSignUp] Erreur inattendue :",
            signUpError.message,
            "— tentative de connexion directe."
          );
        }
      }

      // Récupérer l'userId (depuis signUp ou via connexion directe si l'utilisateur existait déjà)
      let userId = data?.user?.id;
      let activeSession = data?.session;

      // Si pas de session ou pas d'userId (cas du rate limit ou utilisateur pré-existant)
      if (!activeSession || !userId) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        });

        if (signInError) {
          // Si l'utilisateur n'existe pas vraiment (rate limit bloquant)
          if (
            signInError.message.includes("Invalid login credentials") ||
            signInError.message.includes("invalid_credentials")
          ) {
            toast.error("Inscription échouée", {
              description: "Impossible de créer votre compte pour le moment. Réessayez dans quelques instants.",
            });
          } else {
            toast.error("Erreur de connexion", {
              description: signInError.message,
            });
          }
          return;
        }

        activeSession = signInData.session;
        userId = signInData.user?.id;
      }

      if (!userId) {
        toast.error("Erreur lors de la création du compte.");
        return;
      }

      const authUserId = activeSession?.user?.id || userId;

      // 3. Garantir que le profil et le numéro de téléphone obligatoire sont enregistrés
      await supabase.from("profiles").upsert({
        id: authUserId,
        full_name: cleanBusinessName,
        phone: cleanPhone,
        role: "merchant",
      }, { onConflict: "id" });

      const baseSlug = cleanUser.replace(/[^a-z0-9]/g, "-") || "commerce";

      let { data: mRow } = await supabase
        .from("merchants")
        .select("*")
        .eq("owner_id", authUserId)
        .maybeSingle();

      // Repli défensif au cas où le trigger n'a pas été exécuté dans Supabase
      if (!mRow) {
        const uniqueSlug = `${baseSlug}-${authUserId.slice(0, 5)}`;
        let insertRes = await supabase
          .from("merchants")
          .insert({
            owner_id: authUserId,
            name: cleanBusinessName,
            phone: cleanPhone,
            slug: uniqueSlug,
            status: "active",
            plan: "starter",
            subscription_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            is_trial: true,
          })
          .select()
          .maybeSingle();

        if (insertRes.error) {
          console.warn("[handleSignUp] Erreur insertion complète commerce, tentative fallback basique :", insertRes.error.message);
          insertRes = await supabase
            .from("merchants")
            .insert({
              owner_id: authUserId,
              name: cleanBusinessName,
              phone: cleanPhone,
              slug: uniqueSlug,
              status: "active",
              plan: "starter",
            })
            .select()
            .maybeSingle();
        }

        if (insertRes.data) mRow = insertRes.data;
      } else {
        // Le commerce existe déjà (ex. trigger Supabase) : synchroniser le téléphone
        await supabase
          .from("merchants")
          .update({ phone: cleanPhone })
          .eq("id", mRow.id);
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-3 py-2 sm:px-4 sm:py-12 overflow-x-hidden">

      {/* Fond décoratif */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-chart-1/8 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] space-y-3 sm:space-y-6 my-auto">

        {/* Logo */}
        <div className="flex flex-col items-center gap-1.5 sm:gap-3">
          <img
            src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
            alt="M3ak Logo"
            className="h-10 sm:h-14 w-auto object-contain drop-shadow-lg"
          />
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            {mode === "signin" ? "Connectez-vous à votre espace" : "Créez votre programme de fidélité"}
          </p>
        </div>

        {/* Card formulaire */}
        <div className="rounded-2xl border border-border bg-surface/90 p-4 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">

          {/* Onglets Sign In / Sign Up */}
          <div className="mb-3 sm:mb-6 flex rounded-xl bg-surface-muted p-1">
            <button
              className={`flex-1 rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all ${
                mode === "signin"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("signin"); setErrors({}); }}
            >
              Connexion
            </button>
            <button
              className={`flex-1 rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("signup"); setErrors({}); }}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-2.5 sm:space-y-4">

            {/* Nom du commerce (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="businessName" className="text-xs sm:text-sm font-medium">
                  Nom du commerce <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="businessName"
                  placeholder="Ex: Café du Marché"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="organization"
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                />
                {errors['businessName'] && (
                  <p className="text-[11px] text-destructive font-medium">{errors['businessName']}</p>
                )}
              </div>
            )}

            {/* Numéro de téléphone du commerçant (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phone" className="text-xs sm:text-sm font-medium">
                    Numéro de téléphone <span className="text-destructive font-bold">*</span>
                  </Label>
                  <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">
                    Obligatoire
                  </span>
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-3.5 sm:size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    required
                    aria-required="true"
                    placeholder="0550 12 34 56 ou 06 / 07..."
                    className="pl-8 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                {errors['phone'] && (
                  <p className="text-[11px] text-destructive font-medium">{errors['phone']}</p>
                )}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1">
              <Label htmlFor="username" className="text-xs sm:text-sm">Nom d'utilisateur</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-3.5 sm:size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  placeholder="moncommerce"
                  className="pl-8 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
                  disabled={loading}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
              {errors['username'] && (
                <p className="text-[11px] text-destructive">{errors['username']}</p>
              )}
            </div>

            {/* Mot de passe et confirmation */}
            <div className={mode === "signup" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-1"}>
              {/* Mot de passe */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs sm:text-sm">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-3.5 sm:size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder={mode === "signin" ? "••••••••" : "Min 6 car."}
                    className="pl-8 sm:pl-9 pr-9 h-9 sm:h-10 text-xs sm:text-sm"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    disabled={loading}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors['password'] && (
                  <p className="text-[11px] text-destructive">{errors['password']}</p>
                )}
              </div>

              {/* Confirmer mot de passe (signup only) */}
              {mode === "signup" && (
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">Confirmation</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-3.5 sm:size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-8 sm:pl-9 pr-9 h-9 sm:h-10 text-xs sm:text-sm"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  {errors['confirmPassword'] && (
                    <p className="text-[11px] text-destructive">{errors['confirmPassword']}</p>
                  )}
                </div>
              )}
            </div>

            {/* Info activation immédiate (signup) */}
            {mode === "signup" && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Compte activé automatiquement avec essai 7 jours gratuit.</span>
              </div>
            )}

            <Button
              type="submit"
              className="mt-1 w-full h-9 sm:h-10 text-xs sm:text-sm font-bold"
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
        <div className="text-center text-xs sm:text-sm text-muted-foreground pb-2">
          Vous êtes un client ?{" "}
          <button
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={async () => {
              navigate({ to: "/customer" });
            }}
          >
            Accéder à votre portefeuille
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground">
          M3ak Loyalty · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
