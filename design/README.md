# ClinicFlow — V1 screen designs

15 frames: login, onboarding, dashboard, calendar (appointment panel → complete & charge → receipt),
patients list, patient overview, patient billing ledger, finances, ⌘K palette, tablet visit mode,
2 mobile screens (Albanian), and a UI-kit sheet.

## Getting it into Figma

**Option A: SVG (built in, fastest)**
Drag the files from `svg/` onto a Figma canvas. Each one becomes a frame with editable
vector shapes and live text layers. Inter is built into Figma, so the text renders correctly.
Known limits: diagonal-stripe fills (no-show, lunch break, upcoming rows) become flat fills,
and layers come in as groups, not auto-layout.

**Option B: html.to.design plugin (better structure)**
Install the free "html.to.design" plugin in Figma → Import → upload the files in `html/`.
You get auto-layout frames, named layers and real text styles. This is closest to the code.

`png/` holds @2x reference renders of every frame.

## Moving on to the frontend
- `globals.css`: shadcn/ui theme variables (HSL) plus status and service colours. Paste it into
  `app/globals.css`.
- `tokens.json`: the same tokens for Figma Variables / Tokens Studio.
- Icons are Lucide (the shadcn default). Font: Inter.
