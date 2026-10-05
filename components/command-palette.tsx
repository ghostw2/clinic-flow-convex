"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  LayoutDashboard,
  Search,
  Stethoscope,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoneyAmount } from "@/components/money-amount";
import { avatarTint, initials } from "@/lib/format";

type PaletteContextValue = { open: () => void; close: () => void };
const PaletteContext = React.createContext<PaletteContextValue | null>(null);

/** Global ⌘K palette (frame 11). Throws outside the provider on purpose --
 * every authenticated page is expected to render under it (wired once in
 * app/[locale]/layout.tsx), so a missing provider is a real wiring bug, not
 * a case to silently no-op. */
export function useCommandPalette(): PaletteContextValue {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <PaletteContext.Provider value={{ open, close }}>
      {children}
      {isOpen && <CommandPaletteDialog onClose={close} />}
    </PaletteContext.Provider>
  );
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Palette");
  const router = useRouter();
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(id);
  }, [term]);

  const patients = useQuery(api.patients.searchPatients, debounced ? { term: debounced } : "skip");

  function go(path: string) {
    router.push(path);
    onClose();
  }

  const actions = [
    { key: "newAppointment", icon: UserRoundPlus, path: "/calendar" },
    { key: "walkIn", icon: Stethoscope, path: "/calendar" },
    { key: "newPatient", icon: UserRoundPlus, path: "/patients" },
  ].filter((a) => !debounced || t(`action.${a.key}`).toLowerCase().includes(debounced.toLowerCase()));

  const destinations = [
    { key: "dashboard", icon: LayoutDashboard, path: "/" },
    { key: "calendar", icon: CalendarDays, path: "/calendar" },
    { key: "patients", icon: Users, path: "/patients" },
    { key: "finances", icon: Wallet, path: "/finances" },
  ].filter((d) => !debounced || t(`goTo.${d.key}`).toLowerCase().includes(debounced.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("placeholder")}
            className="grow bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {actions.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t("actions")}
              </div>
              {actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => go(a.path)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                >
                  <a.icon className="size-4 text-muted-foreground" />
                  {t(`action.${a.key}`)}
                </button>
              ))}
            </div>
          )}

          {debounced && (
            <div className="mb-1">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t("patients")}
              </div>
              {patients === undefined ? (
                <div className="px-2.5 py-2 text-sm text-muted-foreground">{t("searching")}</div>
              ) : patients.length === 0 ? (
                <div className="px-2.5 py-2 text-sm text-muted-foreground">{t("noResults")}</div>
              ) : (
                patients.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => go(`/patients/${p._id}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
                  >
                    <Avatar size="sm" className={avatarTint(p._id)}>
                      <AvatarFallback className={avatarTint(p._id)}>
                        {initials(`${p.firstName} ${p.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grow">
                      <span className="block text-sm font-semibold">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {p.balance > 0 ? (
                          <>
                            {t("owes")} <MoneyAmount amount={p.balance} className="text-xs" /> ·{" "}
                          </>
                        ) : null}
                        {p.phone}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {destinations.length > 0 && (
            <div>
              <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t("goToSection")}
              </div>
              {destinations.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => go(d.path)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                >
                  <d.icon className="size-4 text-muted-foreground" />
                  <span className="grow">{t(`goTo.${d.key}`)}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
