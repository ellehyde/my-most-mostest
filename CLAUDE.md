# My Most Mostest — site guide

This repo hosts **mymostmostest.com**, the landing page for the children's book
*My Most Mostest* (author **Brie Hollingsworth Krebs**, illustrated by **Elle Harting**).
This file documents what everything is, how it's hosted, how to change it safely, and what
we've done historically. Keep it updated as things change.

---

## What the site is

- A **single, self-contained HTML file** (`index.html`, ~10 MB). It is *not* WordPress and
  has no build step, framework, or backend of its own.
- The page is a "bundled" artifact: a small runtime assembles the page at load time from
  data embedded directly in the file as base64. There is nothing external to fetch (all
  images and fonts are inlined), which is why the file is large.

### File structure (`index.html`)
The page is built from four `<script>` blocks:

| Block | `type` | What it holds |
|-------|--------|---------------|
| Template | `__bundler/template` | The **page content** — a `text/x-dc` (React-like) component. This is where the visible text, layout, and the contact-form logic live. **Edit here for content/copy changes.** |
| Assets | `__bundler/ext_resources` | All **images and fonts**, base64-encoded. |
| Manifest | `__bundler/manifest` | Ties the template and assets together. |
| Runtime | plain `<script>` (×2) | The bundler code that decodes the above and renders the page. Don't touch. |

Other files:
- `CNAME` — contains `mymostmostest.com`; tells GitHub Pages the custom domain.
- `CLAUDE.md` — this file.

There is also a local working copy at `~/Desktop/Claude Projects/my most mostest/` containing
`index.html` and `My Most Mostest.html` (an earlier export). The deployed file is `index.html`.

---

## Hosting & infrastructure

- **Host:** GitHub Pages, repo **`ellehyde/my-most-mostest`** (public), served from the
  **`main`** branch, root (`/`).
- **Custom domain:** `mymostmostest.com` via the `CNAME` file. **HTTPS enforced**
  (Let's Encrypt cert, auto-renews; covers apex + `www`).
- **Domain registrar / DNS:** **IONOS** (on the *Instant Domain* contract — not the
  "IONOS Expert 13098478" webspace contract).
  - DNS records are under **Domains & SSL → mymostmostest.com → DNS**.
  - Apex `@` → **A records** `185.199.108.153` / `.109` / `.110` / `.111` (GitHub's shared
    Pages IPs; these are account-agnostic and never need to change when the repo moves).
  - `www` → **CNAME** `ellehyde.github.io`.
  - **Mail records — DO NOT TOUCH:** MX `mx00/mx01.ionos.com`, SPF, DKIM (`s1`/`s2`),
    DMARC. These power email forwarding for `info@mymostmostest.com` →  Elle's + her
    sister's Gmail. Changing them breaks email.
  - Note: the IONOS control panel is frequently slow / times out — retry rather than
    assuming it's broken.

### Contact form ("say hello")
- Posts inline (AJAX) to **FormSubmit**: `https://formsubmit.co/ajax/info@mymostmostest.com`.
  No account or API key. The submission lands in the `info@` inbox (and forwards on).
- Implemented in the `sendContact` handler inside the template block.

---

## Analytics (Google Analytics 4)

- **Tool:** GA4, same Google account as Search Console. **Measurement ID: `G-Q11KK8BV23`**
  (property "My Most Mostest", Web data stream "Website"). Enhanced Measurement is ON, which
  auto-captures outbound clicks and general behavior.
- **Where the tag lives:** the standard `gtag.js` snippet is in the **template `<head>`** only
  (right after the `viewport` meta), *not* the raw `<head>`. It must be in the template because
  the runtime `replaceWith`-es the whole `<html>`, and the runtime re-creates every `<script>`
  in the parsed template (copies attrs + `textContent`, re-inserts, awaits `src` loads) — so
  template `<head>` scripts **do** execute after render. One copy only → no double-counting.
- **`retailer_click` custom event.** A delegated capture-phase `click` listener (inline script,
  same template `<head>` block) fires an explicit event on any outbound retailer link, giving
  clean per-store labels independent of Enhanced Measurement. Schema:
  `gtag('event','retailer_click',{retailer, link_url, link_text, location})`
  - `retailer` — derived from link host: Amazon / Barnes & Noble / Bookshop.org / Walmart.
  - `link_url` — the full destination href. `link_text` — the trimmed anchor text (≤100 chars).
  - `location` — the page section: `header` (nav CTA), `hero` (the `#buy` section), or
    `retailers` (the `#retailers` section).
  - Retailer URLs themselves are unchanged (GA4 records the destination). To read: GA4 →
    Engagement → Events → `retailer_click`, broken down by `retailer`, for "which store wins".
  - The three Amazon CTAs are all captured here and distinguished by `location` + `link_text`:
    "get the book" (`header`), "get the paperback →" (`hero`), "or the hardcover" (`hero`,
    the hardcover ASIN B0H15KS15S).
- **`email_signup` / `contact_submit` conversions.** Fired inside the template component's
  `subscribeList` / `sendContact` handlers, right before the success `setState` (so they only
  fire on a real submit; `subscribeList` still early-returns on empty email → no event):
  `gtag('event','email_signup',{location:'signup'})` and
  `gtag('event','contact_submit',{location:'hello'})`.
- **Custom dimensions to register (GA4 → Admin → Custom definitions → Create):** event-scoped,
  so the parameters become usable in standard reports (going forward only): `Retailer`←`retailer`,
  `Click location`←`location`, `Link text`←`link_text`. Without these, the events still count but
  the parameter breakdowns only show in Realtime / DebugView.
- **UTM convention (inbound links only).** For links Elle *shares* pointing back to the site:
  `https://mymostmostest.com/?utm_source=SOURCE&utm_medium=MEDIUM&utm_campaign=CAMPAIGN`
  (e.g. `?utm_source=instagram&utm_medium=social&utm_campaign=bio`). GA4 attributes these under
  Acquisition. **Never** put UTMs on the retailer buttons — those stores ignore `utm_*`.
- **Privacy:** default measurement only, no PII. Running without a consent banner (common US
  practice); a lightweight EU/UK consent banner can be added later if desired (not built).

---

## How to edit the site safely

**Content/text changes live inside the base64 `__bundler/template` block**, so you can't just
find-and-replace in the raw HTML. The safe process:

1. Decode the JSON in the `__bundler/template` script tag.
2. Edit the decoded string.
3. Re-encode with the **required `<`-escaping**:
   `json.dumps(tpl).replace('<', '<')`
   — this is **mandatory**. It prevents inner `</script>` sequences in the content from
   prematurely closing the template's own `<script>` tag. A plain `json.dumps` has corrupted
   the page before.
4. **Verify** the re-encoded template region contains exactly **one** `</script>` before
   deploying.

### Deploying
1. Make the edit to `index.html`.
2. Commit and push to `main`:
   ```
   git add index.html
   git commit -m "…"
   git pull --rebase
   git push
   ```
3. GitHub Pages rebuilds automatically (usually < 1 min). Verify:
   ```
   curl -sI https://mymostmostest.com   # expect HTTP/2 200
   ```

### Access / auth
- The repo lives under the personal account **`ellehyde`**.
- The old work account **`eharting-builtmighty`** was retained as a **collaborator with push
  access** after the transfer, so either account can currently deploy. Long term, authenticate
  as `ellehyde` (`gh auth login`) so deploys are owned directly by the personal account.

---

## SEO

**Important architecture gotcha:** the runtime renders by
`document.documentElement.replaceWith(DOMParser.parseFromString(template))` — it **replaces the
entire `<html>`** with the decoded `__bundler/template`. So anything in the *raw* `<head>` is
**discarded once JS runs**. Metadata therefore lives in **two places and must be kept in sync**:

1. **Raw `<head>`** (top of `index.html`, before the `__bundler` scripts) — what non-JS crawlers
   (Bing, Facebook/iMessage/Slack scrapers) and the pre-render see. Edit directly.
2. **Template `<head>`** (inside the base64 `__bundler/template`, right after its `viewport`
   meta) — what Googlebot sees after it renders JS. Edit via the decode/re-encode dance.

What's set in both: `<title>`, meta description, `robots`, `author`, canonical, favicon
(`/favicon.svg`) + apple-touch-icon (`/cover.jpg`), Open Graph + Twitter tags (image =
`/og-cover.jpg`, 1200×630), and a JSON-LD `Book` (`application/ld+json`) with author, illustrator,
audience, and hardcover/paperback `workExample`+`offers`. `<html lang="en">` is set in both too.

Also in the repo root: `cover.jpg` (400×400, extracted from the bundle), `og-cover.jpg` (branded
1200×630 share card), `favicon.svg`, `robots.txt`, `sitemap.xml`. The `<noscript>` block (raw
HTML) holds a real content fallback (H1, description, buy links) for non-JS crawlers.

Verify changes with the Google Rich Results Test, Facebook Sharing Debugger, and
`curl -s https://mymostmostest.com | grep -iE '<title>|og:image|ld\+json'`.

## Preview / staging workflow

To review a change on a real device **before** it goes live, use the preview URL:
**https://mymostmostest.com/preview/** (served from `preview/index.html` in the repo root).

It's a `noindex, nofollow` copy (robots meta set in **both** the raw and template `<head>`) with
`canonical` still pointing at the production root, so it never competes with the real page in
search. Because it's on the **same domain**, the root-absolute asset paths (`/cover.jpg`,
`/favicon.svg`, `/og-cover.jpg`) resolve correctly — a separate project-Pages repo would break
them, which is why we use a `/preview/` path instead.

**Flow for a candidate change:**
1. Apply the change to a working copy and write it to `preview/index.html`. **Keep the
   `content="noindex, nofollow"` robots meta in both heads** — don't let an `index, follow`
   version land in `/preview/`.
2. Commit + push. Review at `https://mymostmostest.com/preview/` (hard-refresh; the 10 MB file
   caches hard).
3. Once approved, apply the **same** change to the root `index.html` (with `index, follow`) and
   deploy to root.
4. `preview/index.html` just holds the last-previewed build between reviews; resync it from the
   current production `index.html` when starting a fresh preview.

## History / changelog

- **2026-07-10** — Site stood up on GitHub Pages under the work account
  `eharting-builtmighty/my-most-mostest` with custom domain `mymostmostest.com` (CNAME + IONOS
  A records) and HTTPS enforced.
- **2026-07-10** — Contact form switched from a `mailto:` redirect to an inline FormSubmit
  AJAX POST to `info@mymostmostest.com` (FormSubmit endpoint activated same day).
- **~2026-07-10/13** — `www` subdomain fixed: IONOS record for `www` changed from an A record
  to a CNAME (was 404ing before).
- **2026-07-13** — **Repo transferred** from `eharting-builtmighty` → **`ellehyde`** (personal
  account), to move ownership off the work account. Apex DNS unchanged (account-agnostic IPs);
  `www` CNAME repointed to `ellehyde.github.io`. Pages, custom domain, and HTTPS all confirmed
  healthy post-transfer. This `CLAUDE.md` added.
- **2026-07-13** — **Mobile header → hamburger menu.** (Iterated from an earlier same-day fix
  that spread the links out and dropped the CTA to its own row.) On mobile (`@media
  (max-width:600px)`, in the template's 2nd `<style>`) the three nav links now collapse into a
  pure-CSS **hamburger menu** (checkbox-hack: hidden `#navToggle` + `#navBurger` label with 3
  bars that animate to an X; `#navToggle:checked ~ #navMenu` reveals a dropdown panel). The
  "get the book" button (`#navCta`) is hidden on mobile since the hero's hardcover/paperback
  buttons are above the fold. Desktop keeps the inline links + CTA. Note: headless-Chrome
  screenshots mis-composite the fixed nav's absolute dropdown over page content (looks like it
  bleeds through) — it's a rendering artifact, not a real bug; verify on a real device.
- **2026-07-13** — **Logo recolor (all viewports).** Header logo changed from "mostest" blue →
  "**most**" blue + "mostest" black, matching the hero title and the book. Edits the logo
  `<span>` directly (not in a media query), so it applies on every screen size.
- **2026-07-13** — **"say hello" blurb copy.** Trimmed the opener from "want something covered,
  or just want to say hi?" → "want to say hi?" (rest of the paragraph unchanged).
- **2026-07-14** — **SEO Phase A + C.** Replaced `<title>Bundled Page</title>` with a real title
  and added meta description, canonical, `<html lang>`, Open Graph + Twitter tags, JSON-LD `Book`
  structured data, favicon, and a crawlable `<noscript>` fallback — in **both** the raw `<head>`
  and the template `<head>` (see the SEO section for why). Added `robots.txt`, `sitemap.xml`,
  `cover.jpg`, `og-cover.jpg`, `favicon.svg`.
- **2026-07-14** — **SEO Phase D.** Verified the site in Google Search Console (URL-prefix
  property, HTML-file method → `googlea86823cf66158b58.html` in repo root — do not delete).
- **2026-07-14** — **SEO Phase B.** Added a white "also available at these very fine retailers"
  section (`id="retailers"`) above the footer with buttons for Amazon, Barnes & Noble, Walmart,
  Bookshop.org (styled pills w/ brand-colored dots, not official logos — linking to the hardcover,
  ISBN 9798295863806). Updated the `Book` JSON-LD (both raw + template copies) with the hardcover
  ISBN/gtin13 and 5 retailer `Offer`s.
- **2026-07-14** — **Added `/preview/` staging flow** (`preview/index.html`, a `noindex` copy) for
  reviewing changes on real devices before promoting to root. See the Preview section above.
- **2026-07-15** — **Buy links → Amazon + email signup + copy.** All CTAs now point to Amazon
  (header "get the book" + hero primary → paperback `B0H13DP6TN`; hero "or the hardcover" →
  `B0H15KS15S`). "Other retailers" reordered to Amazon(PB), Barnes & Noble, Bookshop.org, Walmart
  (all paperback, ISBN 9798295863783). IngramSpark removed everywhere (site + JSON-LD). Added a
  yellow **email signup bar** (`id="signup"`) between `story` and `favorites` — reuses the
  component pattern (`listEmail`/`listSubbed`/`subscribeList`), **capturing via FormSubmit to
  info@ as an interim; TODO: swap to MailerLite** once Elle creates the account + sends the form
  endpoint (one-line change in `subscribeList`). Trimmed the "say hello" blurb, removed the
  vestigial `signup`/`subscribe` stub, and **removed all em-dashes** from copy (hyphens instead).
- **2026-07-16** — **Analytics: GA4 + `retailer_click` tracking.** Added the `gtag.js` snippet
  (Measurement ID `G-Q11KK8BV23`) plus a delegated outbound-click listener to the **template
  `<head>`** (after the `viewport` meta), in both root (`index, follow`) and `preview/`
  (`noindex, nofollow`) copies. The listener fires a `retailer_click` event
  (`{retailer, link_url, link_text, location}`) on Amazon/B&N/Bookshop.org/Walmart links for clean
  per-store reporting; Enhanced Measurement's auto outbound-click stays on as a backstop. Verified
  headlessly with jsdom (config fires, all 7 retailer anchors fire correct `retailer_click`s with
  right labels + section `location`, non-retailer links stay silent). See the new Analytics
  section. Follow-ups for Elle: (1) GA4 Admin → Product links → link Search Console;
  (2) verify live via GA4 Realtime after deploy.
- **2026-07-16** — **Analytics: added `email_signup` + `contact_submit` conversion events.** Wired
  `gtag('event',...)` into the template's `subscribeList` / `sendContact` handlers at their success
  `setState` (empty-email signup still no-ops → no event). The three Amazon CTAs were already
  covered by `retailer_click` (distinguished via `location` + `link_text`). Verified by executing
  the extracted handler bodies with stubbed `this`/`fetch`/`gtag` (events fire on submit, behavior
  preserved, empty-email fires nothing). Documented the 3 custom dimensions to register
  (`Retailer`, `Click location`, `Link text`).
