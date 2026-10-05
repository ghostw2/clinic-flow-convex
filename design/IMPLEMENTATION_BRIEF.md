# ClinicFlow frontend: implementation brief for Claude Code

This folder (`design/`) holds the approved V1 designs. Build the Next.js frontend to match them,
wired to the Convex backend that already exists in `convex/`.

## Source of truth, in order
1. `png/*.png`: what each screen must look like (@2x renders). Look at the image before building a screen.
2. `html/*.html`: exact spacing, sizes, colours and copy. Read these for values, but do NOT copy the
   inline styles or class names. Rebuild with Tailwind + shadcn/ui components.
3. `globals.css` + `tokens.json`: theme tokens. Port them into `app/globals.css`. If the project uses
   Tailwind v4 / the newer shadcn (oklch + `@theme inline`), convert the values and keep the token names.
4. The existing Convex schema and functions. Never invent backend fields; if a screen needs data that
   doesn't exist yet, stub it in the UI and list it in a TODO.

## Stack and conventions
- Next.js App Router, TypeScript, shadcn/ui, Tailwind, Lucide icons, Inter (via `next/font`).
- Convex React hooks (`useQuery`, `useMutation`) and Convex Auth for sign-in.
- i18n from day one: `next-intl` with `messages/en.json` and `messages/sq.json`. No hard-coded UI strings.
  Albanian copy for the mobile screens is in frames 13 and 14.
- Money: format with one helper, `formatALL(amount)` → `ALL 12,200`, tabular numbers.
- Status → colour mapping lives in ONE place (`lib/status.ts`), used by badges and the calendar.

## Screens → routes
| Frame | Route |
|---|---|
| 01 Login | `/login` |
| 02 Onboarding | `/onboarding` (4 steps: clinic type, details, hours, services) |
| 03 Dashboard | `/` |
| 04–06 Calendar + panel + charge + receipt | `/calendar?date=&appt=` (panel state is part of the URL; never a new page) |
| 07 Patients list | `/patients` |
| 08–09 Patient record | `/patients/[id]` with tabs Overview · Appointments · Billing · Files |
| 10 Finances | `/finances` with tabs Today · Outstanding · Receipts · Reports |
| 11 Command palette | global `⌘K` (shadcn `Command`) |
| 12 Tablet visit mode | same calendar route; layout switches at the tablet breakpoint |
| 13–14 Mobile | same routes, responsive; charge panel becomes a bottom `Sheet` |

## Shared components to build first
- `AppShell`: dark sidebar (nav, clinic switcher, setup checklist card, user + EN/SQ toggle), topbar.
- `DataTable` (TanStack Table + shadcn Table): selection, sorting, footer with bulk actions and pagination.
- `EntityDrawer`: docked on ≥1280px, overlay below that, bottom sheet on mobile. Steps inside one drawer.
- `FormField`: label, required mark, hint, error (incl. the duplicate-patient warning in frame 15).
- `StatusBadge`, `ServiceDot`, `MoneyAmount`, `BalanceCard`, `StatTile`, `Avatar` with initials.
- `DayCalendar`: time grid, practitioner columns, now-line, colour by service/status toggle.

## Build order (one PR / session each)
1. Tokens + fonts + `AppShell` + i18n setup + `login` (Convex Auth).
2. Shared components above, shown on a `/dev/kit` page that matches frame 15.
3. Patients list + patient record (Overview, Billing ledger).
4. Calendar day view + appointment drawer → Complete & charge → receipt (the critical loop, target: under 60s).
5. Dashboard, Finances, ⌘K palette.
6. Onboarding, tablet visit mode, mobile polish.

## Definition of done for each screen
- Matches the PNG at 1440px (desktop), 1180px (tablet) and 390px (phone) where a frame exists.
- All strings in both `en.json` and `sq.json`.
- Real Convex data, loading and empty states included.
- `npm run build` and lint pass.
