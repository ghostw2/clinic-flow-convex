"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Smile,
  Sparkles,
  Stethoscope,
  Venus,
  Wand2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { CLINIC_TYPE_SEED_SERVICES, type ClinicType } from "@/convex/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { LanguageToggle } from "@/components/language-toggle";
import { formatALL } from "@/lib/format";

const CLINIC_TYPES: { value: ClinicType; icon: typeof Smile }[] = [
  { value: "dental", icon: Smile },
  { value: "general", icon: Stethoscope },
  { value: "gynecology", icon: Venus },
  { value: "physio", icon: Activity },
  { value: "dermatology", icon: Sparkles },
  { value: "aesthetic", icon: Wand2 },
  { value: "multi-specialty", icon: Layers },
];

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const; // Mon..Sun, 0 = Sunday (schema convention)

type Hours = { weekday: number; openMin: number; closeMin: number; closed: boolean };

function defaultHours(): Hours[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    openMin: 9 * 60,
    closeMin: 18 * 60,
    closed: weekday === 0 || weekday === 6,
  }));
}

function minutesToInput(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function inputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = React.useState(1);
  const [clinicType, setClinicType] = React.useState<ClinicType>("dental");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [nipt, setNipt] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [hours, setHours] = React.useState<Hours[]>(defaultHours);
  const [submitting, setSubmitting] = React.useState(false);
  const [clinicId, setClinicId] = React.useState<string | null>(null);

  const initClinic = useMutation(api.clinic.initClinic);
  const seedClinicType = useMutation(api.onboarding.seedClinicType);
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);
  const services = useQuery(api.services.listServices, clinicId ? { activeOnly: true } : "skip");

  const steps = [t("stepType"), t("stepDetails"), t("stepHours"), t("stepServices")];

  async function handleContinue() {
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    if (step === 3) {
      setSubmitting(true);
      try {
        const id = await initClinic({
          name,
          address,
          nipt,
          phone,
          timezone: "Europe/Tirane",
          currency: "ALL",
          defaultLocale: locale === "sq" ? "sq" : "en",
          clinicType,
          workingHours: hours,
        });
        await seedClinicType({ clinicType });
        setClinicId(id);
        setStep(4);
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await completeOnboarding({});
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  const detailsValid = name.trim() && address.trim() && nipt.trim() && phone.trim();
  const starterServices = CLINIC_TYPE_SEED_SERVICES[clinicType];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-8 py-4">
        <div className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <div className="flex size-[30px] items-center justify-center rounded-[9px] bg-brand-950 text-brand-300">
            <Activity className="size-[18px]" strokeWidth={2.4} />
          </div>
          ClinicFlow
        </div>
        <div className="mx-auto flex items-center gap-3">
          {steps.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="h-px w-8 bg-border" />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    i + 1 <= step ? "bg-brand-950 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1 < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${i + 1 === step ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <LanguageToggle theme="light" />
      </header>

      <div className="mx-auto flex w-full max-w-3xl grow flex-col px-6 py-12">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("stepOf", { step, total: 4 })}
          </div>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">{t(`title${step}`)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t(`subtitle${step}`)}</p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {CLINIC_TYPES.map(({ value, icon: Icon }) => {
                const selected = value === clinicType;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setClinicType(value)}
                    className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left ${
                      selected ? "border-brand-500 bg-brand-50" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{t(`clinicType.${value}.name`)}</div>
                      <div className="text-xs text-muted-foreground">{t(`clinicType.${value}.subtitle`)}</div>
                    </div>
                    {selected && (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-status-done text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
              <span className="font-semibold">{t("starterPack", { count: starterServices.length })}</span>{" "}
              <span className="text-muted-foreground">
                {starterServices.map((s) => s.name).join(", ")}
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("clinicName")} required htmlFor="ob-name" className="col-span-2">
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={t("address")} required htmlFor="ob-address" className="col-span-2">
              <Input id="ob-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormField>
            <FormField label={t("nipt")} required htmlFor="ob-nipt">
              <Input id="ob-nipt" value={nipt} onChange={(e) => setNipt(e.target.value)} />
            </FormField>
            <FormField label={t("phone")} required htmlFor="ob-phone">
              <Input id="ob-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2">
            {hours.map((h, i) => (
              <div key={h.weekday} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5">
                <label className="flex w-28 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, closed: !e.target.checked } : row)),
                      )
                    }
                  />
                  {t(`weekday.${h.weekday}`)}
                </label>
                {h.closed ? (
                  <span className="text-sm text-muted-foreground">{t("closed")}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={minutesToInput(h.openMin)}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, openMin: inputToMinutes(e.target.value) } : row,
                          ),
                        )
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={minutesToInput(h.closeMin)}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, closeMin: inputToMinutes(e.target.value) } : row,
                          ),
                        )
                      }
                      className="w-28"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2">
            {!services ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : (
              services.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.colour }} />
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.durationMin} min</span>
                  </div>
                  <span className="font-semibold tabular-nums">{formatALL(s.price)}</span>
                </div>
              ))
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">{t("editLaterHint")}</p>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-8 py-4">
        <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="size-4" /> {t("back")}
        </Button>
        {step < 4 ? (
          <Button disabled={(step === 2 && !detailsValid) || submitting} onClick={handleContinue}>
            {t("continue")} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button disabled={submitting} onClick={handleFinish}>
            {t("finish")} <Check className="size-4" />
          </Button>
        )}
      </footer>
    </div>
  );
}
