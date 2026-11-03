# CLAUDE.md

הוראות לכל סוכן AI (ולכל מפתח) שעובד במאגר הזה.

## Brand rules are binding

This is **viper fleet**, a Hebrew-first (RTL) fleet tracking UI built on Traccar.
Everything you create or change has to follow **[BRAND.md](BRAND.md)**: code, UI, copy, icons, docs,
reports and any generated asset. Read BRAND.md before any visual or copy change. If a request conflicts
with it, say so and ask; do not quietly break the brand. The brand book PDF and the vector files in
`brand/` take precedence over everything else.

The rules you will need most often:

- **Colors** come only from `src/common/theme/tokens.js` through `theme.palette.*`. ESLint blocks raw
  `#hex`, `rgb()` and `hsl()` values outside `src/common/theme`. Never add a hue that isn't in the brand
  palette (navy `#102C54`, aqua `#35D7D6`, ice `#E1F5F7`, paper `#F8FCFD`, ink `#0A1C30`, slate
  `#567286`, white). The design is flat: no gradients, no glows, no colored glass.
- **No aqua text on light backgrounds.** It fails contrast. Use navy (`primary` in light mode) or
  `aqua[800]`.
- **Main actions** are aqua with ink text. `<Button variant="contained">` already does this; elsewhere use
  `ctaFill(theme)`. Use one main action per screen.
- **Navigation** is a navy rail. The active item is an aqua pill with ink text. Information surfaces stay
  light: paper canvas, white cards, ice tiles.
- **Typography**: Sora for Latin text and digits, Assistant for Hebrew, via `theme.typography`. Use
  weights 400–700 only.
- **Logo**: use only `BrandLogo`, `BrandSymbol` and `BrandAppIcon` from
  `src/common/components/brand/BrandLogo.jsx`, in the variants listed in BRAND.md. Never stretch,
  recolor, retype or mirror the logo. It does not flip in RTL.
- **Loading**: full-screen loading goes through `<Loader />` (the brand icon animation in `index.html`);
  area loading uses `<BrandLoader />`. Both are styled once in `public/styles.css` (`.vf-loader`). Do not
  create any other animation of the logo or symbol.
- **RTL**: use logical properties. The emotion RTL plugin flips `left`/`right`/`direction` inside
  `makeStyles`, so anything that must not flip gets an inline `style` or `dir="ltr"`.
- **Strings**: add every new string to both `src/resources/l10n/he.json` and `en.json`.

## Workflow

- `npm install`, then `npm start` (needs a Traccar server on :8082) or `npm run demo` (built-in mock server).
- Before you commit, run `npm run lint`. It includes the brand color guard and must pass with zero warnings.
- Check visual changes in Hebrew/RTL, in light and dark mode, on desktop and mobile widths.
- Do not run the `translation.yml` workflow. It force-pulls `he.json` from Transifex and drops the custom
  strings.
- To deploy, run `sh deploy/deploy.sh` (see README).
