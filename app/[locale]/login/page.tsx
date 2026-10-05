"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { Activity, Check, Eye, EyeOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/language-toggle";
import { FormField } from "@/components/form-field";
import { MoneyAmount } from "@/components/money-amount";

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const { signIn } = useAuthActions();
  const clinic = useQuery(api.clinic.getClinicPublicInfo);

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", {
        email,
        password,
        flow: mode,
        ...(mode === "signUp" ? { name } : {}),
      });
      router.push("/");
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signIn("google");
    } catch {
      setError(t("error"));
    }
  }

  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-50 px-16 py-12 lg:flex">
        <div className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <div className="flex size-[30px] items-center justify-center rounded-[9px] bg-brand-950 text-brand-300">
            <Activity className="size-[18px]" strokeWidth={2.4} />
          </div>
          ClinicFlow
        </div>

        <div className="flex flex-col gap-6">
          <h1 className="max-w-md text-[38px] leading-[1.1] font-bold tracking-tight text-foreground">
            {t("headline")}
          </h1>
          <p className="max-w-md text-muted-foreground">{t("subhead")}</p>
          <ul className="flex flex-col gap-3">
            {[t("bullet1"), t("bullet2"), t("bullet3")].map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-status-done text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-sm text-foreground">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex size-10 items-center justify-center rounded-lg bg-status-cancel-bg text-sm font-semibold text-status-cancel">
            {t("testimonialName")
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </div>
          <div className="grow">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t("testimonialName")}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-status-done-bg px-2 py-0.5 text-xs font-medium text-status-done">
                <Check className="size-3" /> {t("testimonialPaid")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{t("testimonialService")}</div>
            <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-xs">
              <span className="text-muted-foreground">{t("testimonialReceipt", { number: "RC-2026-0042" })}</span>
              <MoneyAmount amount={6000} className="text-xs" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col px-6 py-8 sm:px-16 sm:py-12 lg:w-1/2">
        <div className="flex justify-end">
          <LanguageToggle theme="light" />
        </div>

        <div className="m-auto w-full max-w-sm">
          <h2 className="text-[26px] font-bold tracking-tight">
            {mode === "signIn" ? t("welcomeBack") : t("createAccountHeading")}
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            {mode === "signUp"
              ? t("createAccountSubtitle")
              : clinic?.name
                ? t("signInTo", { clinicName: clinic.name })
                : t("signInGeneric")}
          </p>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 text-sm"
            onClick={handleGoogle}
          >
            <GoogleIcon className="size-4" />
            {t("continueWithGoogle")}
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("orWithEmail")}
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3.5">
            {mode === "signUp" && (
              <FormField label={t("name")} htmlFor="name">
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
            )}
            <FormField label={t("email")} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField
              label={t("password")}
              labelAction={
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => {
                    /* password reset: not part of step 1 */
                  }}
                >
                  {t("forgot")}
                </button>
              }
              htmlFor="password"
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>

            {error && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground">
                  {t.rich(mode === "signIn" ? "errorHintSignIn" : "errorHintSignUp", {
                    link: (chunks) => (
                      <button
                        type="button"
                        className="font-semibold text-primary"
                        onClick={() => {
                          setMode((m) => (m === "signIn" ? "signUp" : "signIn"));
                          setError(null);
                        }}
                      >
                        {chunks}
                      </button>
                    ),
                  })}
                </p>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="h-11 w-full">
              {mode === "signIn"
                ? submitting
                  ? t("signingIn")
                  : t("signIn")
                : submitting
                  ? t("signingUp")
                  : t("signUp")}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signIn" ? t("newClinic") : t("haveAccount")}{" "}
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => {
                setMode((m) => (m === "signIn" ? "signUp" : "signIn"));
                setError(null);
              }}
            >
              {mode === "signIn" ? t("createAccount") : t("signIn")}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {t("footer", { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.28A7.2 7.2 0 0 1 4.88 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.27 6.62l3.99 3.1C6.21 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
