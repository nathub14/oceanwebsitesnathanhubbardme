# Abyssal — Nathan Hubbard

A personal website experienced as a **descent into the deep ocean**. You begin at the
sunlit surface and scroll *down* — through the twilight, midnight, and abyssal zones —
discovering content at depth stations (a submersible, a wreck, field logs, a beacon
array, a deep-sea transmitter). Depth, pressure, and temperature are shown on a diegetic
submersible HUD.

Built as a self-contained static site + one Cloudflare Pages Function. No build step.

---

## Structure

```
index.html            The descent (scene markup, all content stations, styles)
main.js               WebGL engine: Three.js scene, scroll/HUD bindings, contact form, fallbacks
404.html              Themed "lost at depth" page
functions/api/contact.js   Cloudflare Pages Function → sends the contact form via Resend
assets/work-*.svg     Project gallery imagery (replace with real screenshots)
favicon.svg, og.png   Icon + Open Graph share image
_headers              Security headers + caching (CSP, etc.)
robots.txt, sitemap.xml, site.webmanifest
tools/                Dev-only: screenshot loop, OG generator, function tests (not deployed)
```

The 3D requires WebGL. With `prefers-reduced-motion`, no WebGL, or on small screens it
gracefully degrades to a depth-graded static gradient with all content fully readable.

---

## Local development

```bash
# Static preview (no contact function):
python -m http.server 8000        # → http://localhost:8000

# Full preview WITH the contact function (Cloudflare runtime):
npx wrangler pages dev . --port 8788   # → http://localhost:8788
```

Visual regression / screenshot loop (uses the system Edge/Chrome via Playwright):

```bash
npm i               # installs playwright + wrangler (dev only)
npx playwright install chromium
node tools/shoot.mjs http://127.0.0.1:8000/index.html v1   # shoots 8 depths → screenshots/
```

---

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub and create a Cloudflare Pages project pointing at it
   (or run `npx wrangler pages deploy .`). **Build command:** none. **Output dir:** `/`.
2. Add the environment variable used by the contact form, in *Pages → Settings →
   Environment variables*:

   | Variable | Required | Notes |
   |---|---|---|
   | `RESEND_API_KEY` | **yes** | Your [Resend](https://resend.com) API key. Without it the form returns a friendly "transmitter offline" message. |
   | `CONTACT_TO` | no | Destination address. Defaults to `hubbard_nathan@outlook.com`. |
   | `CONTACT_FROM` | no | Verified Resend sender. Defaults to `onboarding@resend.dev` (fine for first deploy; use your own verified domain for production deliverability). |

3. Done. The form posts to `/api/contact`, which is implemented by
   `functions/api/contact.js` (includes validation + a honeypot for spam).

---

## Replace the placeholder content

The fiction is real; the *content* is starter copy. Search-and-replace these:

- **About** — `index.html` `#z-about`: bio paragraphs + the `Focus / Based / Status` rows.
- **Projects** — `index.html` `#z-work`: four `.porthole` cards (title, caption, tag) and
  the matching `assets/work-1..4.svg` (swap for real screenshots; any image works).
- **Logs** — `index.html` `#z-logs`: three `<article class="log">` entries.
- **Links** — `index.html` `#z-links` and the footer: real **GitHub** and **LinkedIn**
  URLs (currently `https://github.com/` / `https://www.linkedin.com/` placeholders).
- **Domain** — replace `https://nathanhubbard.me/` in `index.html` (`<link rel=canonical>`,
  OG tags), `robots.txt`, and `sitemap.xml` with your real domain.
- **OG image** — regenerate after edits: serve the site, then
  `node tools/og.html` workflow (see `tools/og.html`; screenshot it at 1200×630 → `og.png`).
