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
