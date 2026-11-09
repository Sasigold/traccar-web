# viper fleet: marketing site

A standalone site for viper fleet, separate from the app. It is Hebrew-first (RTL) and follows
[BRAND.md](../BRAND.md). Colors come from `src/common/theme/tokens.js` (injected as CSS variables in
`vite.config.js`), and the logo, app icon and Sync Arc come from the app's brand components.

```sh
npm run site          # dev server on :3100
npm run site:build    # static build in website/dist
npm run site:preview  # serve the build
```

The output in `website/dist` is plain static files (relative paths), so any static host works:
Nginx, Vercel, Netlify, S3, or a folder next to the app.

## Before going live

- **Screenshots**: put the images in `website/public/screens/` and set `src` for each one in
  `src/config.js` (for example `'screens/map.png'`). Each slot shows its recommended size until it has
  an image. Desktop screens are 16:10 (2880 × 1800), phones are 9:19.5 (1179 × 2556).
- **Contact**: set `leadEndpoint` (an HTTPS URL that takes a JSON POST: a Supabase edge function, a Make /
  Zapier webhook or a form service) in `src/config.js`. `whatsapp` and `contactEmail` are fallbacks that open
  the visitor's WhatsApp or mail app. With none set, the form says it can't send instead of pretending it did.
  `npm run site:build` warns while these or screenshots are missing.
- **App link**: set `appUrl` in `src/config.js` to the address of the viper fleet app.

## Structure

| File | What it is |
| --- | --- |
| `src/components/journey/` | The scroll-driven drive: trip model (`model.js`), vehicle, road, telemetry and alerts |
| `src/components/Hero.jsx` | Navy hero with the Sync Arc and the main screenshot |
| `src/components/Showcase.jsx` | Product tour tabs with screenshot slots |
| `src/components/Features.jsx` | Feature grid with live mini visuals |
| `src/components/Sections.jsx` | Numbers, steps, mobile, FAQ, contact, footer |
| `src/site.css` | All styles. Colors only through the token variables |

The trip data in the drive is illustrative and marked `ILLUSTRATIVE UI / FICTIONAL DATA` (BRAND.md §8).
